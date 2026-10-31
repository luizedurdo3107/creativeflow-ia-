/** Real-brand, non-pharmaceutical production workflow.
 *  This module NEVER treats generated creative copy as verified information.
 *  Facts come only from the brand profile and a human-authored briefing.
 */
import { z } from 'zod';
import JSZip from 'jszip';
import { db, json } from '../db/client';
import { listBrandProfiles, type BrandProfile } from './brand-profiles.service';
import { newId } from '../utils/id';
import { HttpError } from '../utils/errors';
import { aiStatus } from './ai';
import { generateInstitutionalCopy as llmCopy } from './ai/llm';
import { renderInstitutionalPng } from './render.service';

export const InstitutionFormat = z.enum(['feed', 'story', 'banner']);
export type InstitutionFormat = z.infer<typeof InstitutionFormat>;
const CopySchema = z.object({
  headline: z.string().trim().min(2).max(110),
  subtitle: z.string().trim().min(2).max(220),
  caption: z.string().trim().min(5).max(1000),
  cta: z.string().trim().min(2).max(50),
});
export type InstitutionalCopy = z.infer<typeof CopySchema>;
export const InstitutionalInput = z.object({
  brandId: z.string().min(2).max(40),
  name: z.string().trim().min(3).max(90),
  objective: z.string().trim().min(10).max(650),
  audience: z.string().trim().min(3).max(240),
  keyMessage: z.string().trim().min(10).max(400),
  cta: z.string().trim().min(2).max(50),
  sourceNotes: z.string().trim().min(10).max(1500),
  formats: z.array(InstitutionFormat).min(1).max(3).refine((a) => new Set(a).size === a.length, 'Formato duplicado'),
  confirmed: z.literal(true),
});
export type InstitutionalInput = z.infer<typeof InstitutionalInput>;
const CopyPatch = CopySchema.partial().refine((a) => Object.keys(a).length > 0, 'Informe algum texto para editar');

export interface InstitutionalCampaign {
  id: string;
  brandId: string;
  brand: BrandProfile;
  name: string;
  input: InstitutionalInput;
  copies: InstitutionalCopy;
  aiMode: string;
  status: 'rascunho' | 'aprovada' | 'reprovada';
  createdBy: string;
  reviewedBy: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
}

type DbRow = Record<string, any>;
function map(row: DbRow): InstitutionalCampaign {
  return { id: row.id, brandId: row.brand_id, brand: row.brand_snapshot as BrandProfile,
    name: row.name, input: row.data as InstitutionalInput, copies: row.copies as InstitutionalCopy,
    aiMode: row.ai_mode, status: row.status, createdBy: row.created_by,
    reviewedBy: row.reviewed_by ?? null, reviewNote: row.review_note ?? null,
    createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString(),
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null };
}
async function record(id: string, by: string, action: string, details: Record<string,unknown> = {}) {
  await db().query('insert into institutional_campaign_events(id,campaign_id,actor_id,action,details) values ($1,$2,$3,$4,$5::jsonb)',
    [newId('ievt'),id,by,action,json(details)]);
}
export async function getInstitutionalAudit(id: string) {
  await getInstitutional(id);
  const {rows}=await db().query('select actor_id,action,details,created_at from institutional_campaign_events where campaign_id=$1 order by created_at desc limit 100',[id]);
  return rows.map((r)=>({actorId:r.actor_id,action:r.action,details:r.details,createdAt:new Date(r.created_at as string).toISOString()}));
}

export async function listInstitutional(): Promise<InstitutionalCampaign[]> {
  const { rows } = await db().query('select * from institutional_campaigns order by created_at desc limit 150');
  return rows.map(map);
}
export async function getInstitutional(id: string): Promise<InstitutionalCampaign> {
  const { rows } = await db().query('select * from institutional_campaigns where id=$1', [id]);
  if (!rows[0]) throw new HttpError(404, 'Campanha institucional não encontrada.');
  return map(rows[0]);
}
export function localCopy(input: InstitutionalInput, brand: BrandProfile): InstitutionalCopy {
  const headline = input.name.length <= 48 ? input.name : `Conheça ${brand.name}`;
  return { headline, subtitle: input.keyMessage, cta: input.cta,
    caption: `${input.keyMessage}\n\n${input.cta}\n\n${brand.name} — ${brand.description}`.slice(0, 1000) };
}
async function generateCopy(input: InstitutionalInput, brand: BrandProfile): Promise<{ copy: InstitutionalCopy; mode: string }> {
  if (aiStatus().mode !== 'ia-generativa') return { copy: localCopy(input, brand), mode: 'template-sem-ia' };
  try {
    const copy = CopySchema.parse(await llmCopy(input, brand));
    return { copy, mode: `ia-${aiStatus().provider}` };
  } catch (error) {
    console.warn('IA institucional indisponível; usando briefing verificado:', String(error).slice(0, 180));
    return { copy: localCopy(input, brand), mode: 'template-fallback-ia' };
  }
}
export async function createInstitutional(raw: unknown, by: string) {
  const input = InstitutionalInput.parse(raw);
  const brand = (await listBrandProfiles()).find((b) => b.id === input.brandId);
  if (!brand) throw new HttpError(400, 'Marca não encontrada. Cadastre em Marca e regras.');
  const { copy, mode } = await generateCopy(input, brand);
  const id = newId('inst');
  await db().query(`insert into institutional_campaigns
    (id,brand_id,brand_snapshot,name,data,copies,ai_mode,status,created_by)
    values ($1,$2,$3::jsonb,$4,$5::jsonb,$6::jsonb,$7,'rascunho',$8)`,
  [id, brand.id, json(brand), input.name, json(input), json(copy), mode, by]);
  await record(id, by, 'criada', {brandId:brand.id, aiMode:mode});
  return getInstitutional(id);
}
export async function regenerateInstitutional(id: string, _by: string) {
  const campaign = await getInstitutional(id);
  const { copy, mode } = await generateCopy(campaign.input, campaign.brand);
  await db().query(`update institutional_campaigns set copies=$2::jsonb, ai_mode=$3,
    status='rascunho',reviewed_by=null,reviewed_at=null,review_note=null,updated_at=now() where id=$1`, [id, json(copy), mode]);
  await record(id, _by, 'regenerada', {aiMode:mode});
  return getInstitutional(id);
}
export async function updateInstitutionalCopy(id: string, raw: unknown, _by: string) {
  const patch = CopyPatch.parse(raw);
  const campaign = await getInstitutional(id);
  const copy = CopySchema.parse({ ...campaign.copies, ...patch });
  await db().query(`update institutional_campaigns set copies=$2::jsonb,
    status='rascunho',reviewed_by=null,reviewed_at=null,review_note=null,updated_at=now() where id=$1`, [id, json(copy)]);
  await record(id, _by, 'texto_editado', {fields:Object.keys(patch)});
  return getInstitutional(id);
}
export async function reviewInstitutional(id: string, decision: 'aprovada' | 'reprovada', reviewer: string, note: string) {
  const campaign = await getInstitutional(id);
  if (campaign.createdBy === reviewer) throw new HttpError(403, 'O criador não pode aprovar a própria campanha; peça a um revisor independente.');
  await db().query(`update institutional_campaigns set status=$2,reviewed_by=$3,review_note=$4,
    reviewed_at=now(),updated_at=now() where id=$1`, [id, decision, reviewer, note]);
  await record(id, reviewer, 'revisada', {decision, note});
  return getInstitutional(id);
}

const specs: Record<InstitutionFormat, { width: number; height: number; label: string }> = {
  feed: { width: 1080, height: 1080, label: 'Feed Instagram' },
  story: { width: 1080, height: 1920, label: 'Story' },
  banner: { width: 1920, height: 1080, label: 'Banner' },
};
export function getInstitutionalSpecs() { return specs; }
const xml = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function wrap(s: string, chars: number, maxLines: number): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (lines.length >= maxLines) break;
    if ((line + ' ' + word).trim().length > chars && line) { lines.push(line); line = word; }
    else line = (line + ' ' + word).trim();
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (words.join(' ').length > lines.join(' ').length && lines.length) lines[lines.length - 1] = lines[lines.length - 1].slice(0, Math.max(1, chars - 2)) + '…';
  return lines;
}
function textLines(lines: string[], x: number, y: number, size: number, leading: number, color: string, weight = 700) {
  return lines.map((line, i) => `<text x="${x}" y="${y + i * leading}" fill="${color}" font-size="${size}" font-weight="${weight}" font-family="Arial, sans-serif">${xml(line)}</text>`).join('');
}
function textFill(background: string): string {
  // Calculate WCAG relative luminance for solid brand backgrounds.
  const rgb = [1, 3, 5].map((i) => parseInt(background.slice(i, i + 2),16) / 255).map((n) => n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4);
  return (rgb[0]*0.2126 + rgb[1]*0.7152 + rgb[2]*0.0722) > 0.2 ? '#15232A' : '#FFFFFF';
}
export function institutionalSvg(c: InstitutionalCampaign, f: InstitutionFormat): string {
  const { width:w, height:h } = specs[f];
  const primary = c.brand.colors[0] ?? '#09252D';
  const accent = c.brand.colors[1] ?? '#4E6F5A';
  const fg = textFill(primary);
  const roomy = f === 'story';
  const wide = f === 'banner';
  const margin = wide ? 120 : 95;
  const headingSize = wide ? 80 : roomy ? 76 : 66;
  const maxChars = wide ? 36 : 25;
  const headline = wrap(c.copies.headline, maxChars, wide ? 2 : roomy ? 4 : 3);
  const subtitle = wrap(c.copies.subtitle, wide ? 65 : 38, wide ? 3 : roomy ? 5 : 3);
  const headY = roomy ? 590 : wide ? 315 : 315;
  const bottomY = roomy ? 1630 : wide ? 880 : 940;
  const logo = c.brand.logoDataUri && /^data:image\/(png|jpeg|webp);base64,/.test(c.brand.logoDataUri) ? `<image href="${xml(c.brand.logoDataUri)}" x="${margin}" y="${roomy ? 125 : 72}" width="140" height="140" preserveAspectRatio="xMinYMid meet"/>` : '';
  const brandX = logo ? margin + 160 : margin;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Peça ${xml(c.name)}">
  <rect width="${w}" height="${h}" fill="${primary}"/>
  <circle cx="${w*0.87}" cy="${h*0.73}" r="${wide ? 420 : 370}" fill="${accent}" opacity="0.29"/>
  <circle cx="${w*0.98}" cy="${h*0.79}" r="${wide ? 230 : 220}" fill="${accent}" opacity="0.32"/>
  <circle cx="${w*0.9}" cy="${h*0.16}" r="${wide ? 95 : 85}" fill="${accent}" opacity="0.32"/>
  <line x1="${margin}" y1="${roomy ? 310 : 230}" x2="${w-margin}" y2="${roomy ? 310 : 230}" stroke="${fg}" opacity="0.22" stroke-width="2"/>
  ${logo}
  <text x="${brandX}" y="${roomy ? 215 : 155}" fill="${fg}" font-size="${wide ? 48 : 40}" font-weight="700" font-family="Arial, sans-serif">${xml(c.brand.name)}</text>
  <text x="${margin}" y="${headY-92}" fill="${fg}" opacity="0.8" font-size="${wide ? 30 : 28}" letter-spacing="3" font-family="Arial, sans-serif">${xml(c.input.audience.toUpperCase().slice(0, 44))}</text>
  ${textLines(headline,margin,headY,headingSize,headingSize*1.14,fg,800)}
  ${textLines(subtitle,margin,headY+headline.length*headingSize*1.14+(roomy ? 56 : 38),wide?34:roomy?44:36,wide?45:roomy?64:46,fg,400)}
  <rect x="${margin}" y="${bottomY-90}" rx="22" width="${Math.min(w-margin*2, wide?690:710)}" height="112" fill="${fg}"/>
  <text x="${margin+35}" y="${bottomY-18}" fill="${primary}" font-family="Arial, sans-serif" font-weight="700" font-size="${wide?39:35}">${xml(c.copies.cta.slice(0,40))}</text>
  <text x="${margin}" y="${h-70}" fill="${fg}" opacity="0.75" font-size="${wide?29:26}" font-family="Arial, sans-serif">${xml(c.brand.website || c.brand.name)}</text>
  </svg>`;
}

export async function institutionalZip(c: InstitutionalCampaign, by: string): Promise<Buffer> {
  if (c.status !== 'aprovada') throw new HttpError(409, 'Campanha precisa de aprovação antes da exportação.');
  const zip = new JSZip();
  for (const f of c.input.formats) {
    const png = await renderInstitutionalPng(institutionalSvg(c,f), specs[f].width, specs[f].height);
    zip.file(`${c.brandId}-${f}.png`, png);
  }
  zip.file('legenda.txt', c.copies.caption + '\n');
  zip.file('manifest.json', JSON.stringify({ campaignId:c.id, brandId:c.brandId, brandName:c.brand.name,
    sources:'briefing informado e confirmado pelo usuário', aiMode:c.aiMode, formats:c.input.formats,
    approvedBy:c.reviewedBy, approvedAt:c.reviewedAt, generatedAt:new Date().toISOString(),
    note:'Revisão humana concluída. Uso condicionado às autorizações da marca.' },null,2));
  const result = await zip.generateAsync({ type:'nodebuffer', compression:'DEFLATE', compressionOptions:{level:6} });
  await record(c.id, by, 'exportada', {formats:c.input.formats, sizeBytes:result.length});
  return result;
}
