import { legacyInstitutionalSvg } from './institutional-legacy-render';
/** Real-brand, non-pharmaceutical production workflow.
 *  This module NEVER treats generated creative copy as verified information.
 *  Facts come only from the brand profile and a human-authored briefing.
 */
import { StudioDesign, ChannelId, ChannelTexts, CHANNELS, defaultStudioDesign, renderStudioSvg } from '@cf/shared';
import { isDemo } from '../config/env';
import { z } from 'zod';
import JSZip from 'jszip';
import { db, json } from '../db/client';
import { listBrandProfiles, BrandProfileSchema, type BrandProfile } from './brand-profiles.service';
import { listBrandCatalog, BrandCatalogItemSchema, type BrandCatalogItem } from './brand-catalog.service';
import { newId } from '../utils/id';
import { HttpError } from '../utils/errors';
import { aiStatus } from './ai';
import { generateInstitutionalCopy as llmCopy, editInstitutionalCopy as llmEdit } from './ai/llm';
import { fontFaces, renderInstitutionalPng } from './render.service';
import { generateBrandArtwork, imageAIStatus, readArtwork, storeArtwork, verifyGeneratedImage, type ArtworkMeta } from './image-ai.service';

export const InstitutionFormat = z.enum(['feed', 'portrait', 'story', 'banner']);
export type InstitutionFormat = z.infer<typeof InstitutionFormat>;
export const CopySchema = z.object({
  headline: z.string().trim().min(2).max(110),
  subtitle: z.string().trim().min(2).max(400),
  caption: z.string().trim().min(5).max(1000),
  cta: z.string().trim().min(2).max(50),
});
export type InstitutionalCopy = z.infer<typeof CopySchema>;
export const InstitutionalInput = z.object({
  brandId: z.string().min(2).max(40),
  catalogItemId:z.string().max(60).optional().default(''),
  name: z.string().trim().min(3).max(90),
  objective: z.string().trim().min(10).max(650),
  audience: z.string().trim().min(3).max(240),
  keyMessage: z.string().trim().min(10).max(400),
  cta: z.string().trim().min(2).max(50),
  sourceNotes: z.string().trim().min(10).max(1500),
  formats: z.array(InstitutionFormat).min(1).max(4).refine((a) => new Set(a).size === a.length, 'Formato duplicado'),
  channels:z.array(ChannelId).max(6).refine(a=>new Set(a).size===a.length,'Canal duplicado').optional().default([]),
  confirmed: z.literal(true),
  copyMode:z.enum(['ai','briefing']).optional().default('ai'),
  artDirection: z.string().trim().max(800).optional().default(''),
}).superRefine((input,ctx)=>{
 for(const id of input.channels){const c=CHANNELS.find(c=>c.id===id)!;if(!input.formats.some(f=>(c.formats as readonly string[]).includes(f)))ctx.addIssue({code:'custom',path:['channels'],message:`Selecione um formato compatível com ${c.label}.`});}
 if(input.channels.length)for(const f of input.formats)if(!CHANNELS.some(c=>input.channels.includes(c.id)&&(c.formats as readonly string[]).includes(f)))ctx.addIssue({code:'custom',path:['formats'],message:'Há formato sem canal de destino.'});
});
export type InstitutionalInput = z.infer<typeof InstitutionalInput>;
const CopyPatch = CopySchema.partial().extend({ baseRevision: z.number().int().positive().optional() }).refine((a) => Object.keys(a).some((k) => k !== 'baseRevision'), 'Informe algum texto para editar');

export interface InstitutionalCampaign {
  id: string;
  brandId: string;
  brand: BrandProfile;
  name: string;
  input: InstitutionalInput;
  copies: InstitutionalCopy;
  catalogItem: BrandCatalogItem | null;
  aiMode: string;
  artworks: Partial<Record<InstitutionFormat, ArtworkMeta>>;
  renderVersion:number;
  designs: Partial<Record<InstitutionFormat, StudioDesign>>;
  channelTexts: z.infer<typeof ChannelTexts>;
  status: 'rascunho' | 'em_revisao' | 'aprovada' | 'reprovada';
  revision: number;
  lastEditedBy: string;
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
    name: row.name, input: {...row.data,channels:row.data.channels??[]} as InstitutionalInput, copies: row.copies as InstitutionalCopy,
    catalogItem:row.catalog_snapshot ?? null, aiMode: row.ai_mode, artworks: row.artworks ?? {}, renderVersion:row.render_version??1,designs:row.designs??{},channelTexts:row.channel_texts??{}, status: row.status, createdBy: row.created_by,
    revision: row.revision ?? 1, lastEditedBy: row.last_edited_by ?? row.created_by,
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
  const {rows}=await db().query('select e.actor_id,u.name as actor_name,e.action,e.details,e.created_at from institutional_campaign_events e left join users u on u.id=e.actor_id where e.campaign_id=$1 order by e.created_at desc limit 100',[id]);
  return rows.map((r)=>({actorId:r.actor_id,actorName:r.actor_name??'Integrante da equipe',action:r.action,details:r.details,createdAt:new Date(r.created_at as string).toISOString()}));
}

export async function listInstitutional(): Promise<InstitutionalCampaign[]> {
  const { rows } = await db().query('select * from institutional_campaigns where archived_at is null order by created_at desc limit 150');
  return rows.map(map);
}
export async function getInstitutional(id: string): Promise<InstitutionalCampaign> {
  const { rows } = await db().query('select * from institutional_campaigns where id=$1 and archived_at is null', [id]);
  if (!rows[0]) throw new HttpError(404, 'Campanha institucional não encontrada.');
  return map(rows[0]);
}
export function localCopy(input: InstitutionalInput, brand: BrandProfile): InstitutionalCopy {
  const headline = input.name;
  return CopySchema.parse({ headline, subtitle: input.keyMessage, cta: input.cta,
    caption: `${input.keyMessage}\n\n${input.cta}\n\n${brand.name} — ${brand.description}`.slice(0, 1000) });
}
function assertCommercialCopy(copy:InstitutionalCopy,catalogItem:BrandCatalogItem|null){
  if(catalogItem && /(?:R\$|\d+[.,]\d{2}|\d+\s*%|\breais\b)/i.test([copy.headline,copy.subtitle,copy.caption,copy.cta].join(' '))) throw new HttpError(400,'Preços e condições vêm do item do catálogo. Remova valores comerciais dos textos livres.');
}
async function generateCopy(input: InstitutionalInput, brand: BrandProfile, catalogItem: BrandCatalogItem|null = null): Promise<{ copy: InstitutionalCopy; mode: string }> {
  if(!isDemo() && input.copyMode!=='briefing' && aiStatus().mode!=='ia-generativa')throw new HttpError(503,'A IA ainda não está configurada. Selecione Usar textos do briefing para criar sem IA.');
  if(input.copyMode==='briefing')return {copy:localCopy(input,brand),mode:'briefing-sem-ia'};
  if (aiStatus().mode !== 'ia-generativa') return { copy: localCopy(input, brand), mode: 'template-sem-ia' };
  try {
    const copy = CopySchema.parse(await llmCopy({...input,catalogItem}, brand));
    assertCommercialCopy(copy,catalogItem);
    return { copy, mode: `ia-${aiStatus().provider}` };
  } catch (error) {
    if(!isDemo() && error instanceof HttpError)throw error;
    if(!isDemo())throw new HttpError(502,'Não foi possível gerar os textos pela IA. A campanha não foi alterada. Tente novamente ou escolha usar o briefing sem IA.');
    console.warn('IA institucional indisponível; usando briefing verificado:', String(error).slice(0, 180));
    return { copy: localCopy(input, brand), mode: 'template-fallback-ia' };
  }
}
export async function createInstitutional(raw: unknown, by: string) {
  const input = InstitutionalInput.parse(raw);
  const brand = (await listBrandProfiles()).find((b) => b.id === input.brandId);
  if (!brand) throw new HttpError(400, 'Marca não encontrada. Cadastre em Marca e regras.');
  const catalogItem = input.catalogItemId ? (await listBrandCatalog(brand.id)).find(i=>i.id===input.catalogItemId && i.active) ?? null : null;
  if(input.catalogItemId && !catalogItem) throw new HttpError(400,'Produto ou serviço indisponível para esta marca.');
  assertCommercialCopy(localCopy(input,brand),catalogItem);
  const { copy, mode } = await generateCopy(input, brand, catalogItem);
  const id = newId('inst');
  await db().query(`insert into institutional_campaigns
    (id,brand_id,brand_snapshot,name,data,copies,ai_mode,status,created_by,last_edited_by,catalog_snapshot,render_version,designs)
    values ($1,$2,$3::jsonb,$4,$5::jsonb,$6::jsonb,$7,'rascunho',$8,$8,$9::jsonb,2,$10::jsonb)`,
  [id, brand.id, json(brand), input.name, json(input), json(copy), mode, by, json(catalogItem),json(Object.fromEntries(input.formats.map(f=>[f,defaultStudioDesign(brand,f)])))]);
  await record(id, by, 'criada', {brandId:brand.id, aiMode:mode});
  return getInstitutional(id);
}
/** Reject stale tabs instead of overwriting a more recent edit or review. */
function assertRevision(campaign: InstitutionalCampaign, revision?: number) {
  if (revision !== undefined && revision !== campaign.revision) throw new HttpError(409, 'Esta campanha mudou. Atualize a página e confira a versão atual antes de continuar.');
}
async function saveCopy(campaign: InstitutionalCampaign, copy: InstitutionalCopy, by: string, mode = campaign.aiMode) {
  const { rows } = await db().query(`update institutional_campaigns set copies=$2::jsonb, ai_mode=$3,
    status='rascunho',reviewed_by=null,reviewed_at=null,review_note=null,updated_at=now(),
    revision=revision+1,last_edited_by=$4 where id=$1 and revision=$5 returning id`,
    [campaign.id, json(copy), mode, by, campaign.revision]);
  if (!rows.length) throw new HttpError(409, 'A campanha mudou durante a operação. Atualize e tente novamente.');
}
export async function regenerateInstitutional(id: string, by: string, baseRevision?: number) {
  const campaign = await getInstitutional(id);
  assertRevision(campaign, baseRevision);
  const { copy, mode } = await generateCopy(campaign.input, campaign.brand, campaign.catalogItem);
  await saveCopy(campaign, copy, by, mode);
  await record(id, by, 'regenerada', {aiMode:mode, revision:campaign.revision+1});
  return getInstitutional(id);
}
export async function updateInstitutionalCopy(id: string, raw: unknown, by: string) {
  const { baseRevision, ...patch } = CopyPatch.parse(raw);
  const campaign = await getInstitutional(id);
  assertRevision(campaign, baseRevision);
  const copy = CopySchema.parse({ ...campaign.copies, ...patch });
  assertCommercialCopy(copy,campaign.catalogItem);
  await saveCopy(campaign, copy, by);
  await record(id, by, 'texto_editado', {fields:Object.keys(patch), revision:campaign.revision+1});
  return getInstitutional(id);
}
export async function proposeInstitutionalEdit(id: string, raw: unknown, by: string) {
  const input = z.object({instruction:z.string().trim().min(5).max(800),baseRevision:z.number().int().positive()}).parse(raw);
  const campaign = await getInstitutional(id);
  assertRevision(campaign, input.baseRevision);
  if (/(?:pre[çc]o|desconto|condi[çc][õo]es|R\$|\d+\s*%|sem aprova|publi(?:que|car)|parceria|certifica)/i.test(input.instruction)) {
    throw new HttpError(400, 'O comando não pode mudar dados comerciais, fatos institucionais ou dispensar aprovação. Use-o para ajustar clareza, tom ou tamanho dos textos.');
  }
  if (aiStatus().mode !== 'ia-generativa') throw new HttpError(503, 'Configure o provedor de texto para editar por comando. Você pode editar os campos manualmente enquanto isso.');
  const copy = CopySchema.parse(await llmEdit(campaign, input.instruction));
  assertCommercialCopy(copy,campaign.catalogItem);
  const knownFacts = JSON.stringify({input:campaign.input,brand:{name:campaign.brand.name,description:campaign.brand.description},copy:campaign.copies,catalogItem:campaign.catalogItem});
  const knownNumbers = new Set(knownFacts.match(/\d+(?:[.,]\d+)*/g) ?? []);
  const addedNumber = (JSON.stringify(copy).match(/\d+(?:[.,]\d+)*/g) ?? []).some((n)=>!knownNumbers.has(n));
  if (addedNumber || copy.cta !== campaign.copies.cta) throw new HttpError(422, 'A proposta tentou alterar o CTA ou acrescentar números não fornecidos. Tente um ajuste de estilo sem mudar os fatos.');
  await record(id, by, 'edicao_ia_proposta', {instruction:input.instruction,baseRevision:campaign.revision,provider:aiStatus().provider});
  return {copy,baseRevision:campaign.revision,provider:aiStatus().provider};
}
export async function reviewInstitutional(id: string, decision: 'aprovada' | 'reprovada', reviewer: string, note: string, baseRevision?: number) {
  const campaign = await getInstitutional(id);
  assertRevision(campaign, baseRevision);
  if(!isDemo() && campaign.status!=='em_revisao')throw new HttpError(409,'A campanha precisa ser enviada para revisão antes da decisão.');
  if (campaign.createdBy === reviewer || campaign.lastEditedBy === reviewer) throw new HttpError(403, 'Quem criou ou fez a última edição não pode revisar a própria campanha; peça a um revisor independente.');
  const {rows} = await db().query(`update institutional_campaigns set status=$2,reviewed_by=$3,review_note=$4,
    reviewed_at=now(),updated_at=now(),revision=revision+1 where id=$1 and revision=$5 returning id`, [id, decision, reviewer, note, campaign.revision]);
  if (!rows.length) throw new HttpError(409, 'A campanha mudou durante a revisão. Confira a versão atual.');
  await record(id, reviewer, 'revisada', {decision, note, revision:campaign.revision+1});
  return getInstitutional(id);
}

export async function updateInstitutionalBriefing(id:string,raw:unknown,by:string){
 const parsed=z.object({input:InstitutionalInput,baseRevision:z.number().int().positive()}).parse(raw);const current=await getInstitutional(id);assertRevision(current,parsed.baseRevision);
 const input=parsed.input;const brand=(await listBrandProfiles()).find(b=>b.id===input.brandId);if(!brand)throw new HttpError(400,'Selecione uma marca cadastrada.');
 const item=input.catalogItemId?(await listBrandCatalog(brand.id)).find(i=>i.id===input.catalogItemId&&i.active)??null:null;
 if(input.catalogItemId&&!item)throw new HttpError(400,'Item indisponível para esta marca.');
 assertCommercialCopy(localCopy(input,brand),item);const {copy,mode}=await generateCopy(input,brand,item);
 const {rows}=await db().query(`update institutional_campaigns set brand_id=$2,brand_snapshot=$3::jsonb,name=$4,data=$5::jsonb,copies=$6::jsonb,ai_mode=$7,catalog_snapshot=$8::jsonb,
 artworks='{}'::jsonb,status='rascunho',reviewed_by=null,reviewed_at=null,review_note=null,last_edited_by=$9,revision=revision+1,updated_at=now() where id=$1 and revision=$10 returning id`,[id,brand.id,json(brand),input.name,json(input),json(copy),mode,json(item),by,current.revision]);
 if(!rows.length)throw new HttpError(409,'A campanha mudou enquanto o briefing era atualizado. Recarregue para conferir.');
 await record(id,by,'briefing_editado');return getInstitutional(id);
}
export async function submitInstitutional(id:string,raw:unknown,by:string){
  const {baseRevision}=z.object({baseRevision:z.number().int().positive()}).parse(raw);
  const c=await getInstitutional(id);assertRevision(c,baseRevision);
  if(!isDemo()&&!c.input.channels?.length)throw new HttpError(400,'Escolha os canais da campanha e salve antes de enviar para revisão.');
  if(!['rascunho','reprovada'].includes(c.status))throw new HttpError(409,'Esta campanha já foi enviada ou aprovada.');
  const {rows}=await db().query("update institutional_campaigns set status='em_revisao',revision=revision+1,updated_at=now() where id=$1 and revision=$2 returning id",[id,baseRevision]);
  if(!rows.length)throw new HttpError(409,'A campanha mudou. Atualize antes de enviar.');
  await record(id,by,'enviada_para_revisao');return getInstitutional(id);
}
export async function archiveInstitutional(id:string,by:string){
  await getInstitutional(id);await record(id,by,'arquivada');
  await db().query('update institutional_campaigns set archived_at=now(),revision=revision+1 where id=$1',[id]);return {ok:true};
}
export async function archivedInstitutional(){const {rows}=await db().query('select * from institutional_campaigns where archived_at is not null order by archived_at desc limit 100');return rows.map(map);}
export async function restoreArchivedInstitutional(id:string,by:string){
 const {rows}=await db().query("update institutional_campaigns set archived_at=null,status='rascunho',reviewed_by=null,reviewed_at=null,review_note=null,revision=revision+1,last_edited_by=$2,updated_at=now() where id=$1 and archived_at is not null returning id",[id,by]);
 if(!rows.length)throw new HttpError(404,'Campanha arquivada não encontrada.');await record(id,by,'restaurada');return getInstitutional(id);
}
export async function syncInstitutionalReferences(id:string,raw:unknown,by:string){
 const {baseRevision}=z.object({baseRevision:z.number().int().positive()}).parse(raw);const c=await getInstitutional(id);assertRevision(c,baseRevision);
 const brand=(await listBrandProfiles()).find(b=>b.id===c.brandId);if(!brand)throw new HttpError(400,'Marca indisponível.');
 const item=c.input.catalogItemId?(await listBrandCatalog(c.brandId)).find(i=>i.id===c.input.catalogItemId&&i.active)??null:null;
 if(c.input.catalogItemId&&!item)throw new HttpError(400,'O item selecionado está inativo ou indisponível.');
 const {rows}=await db().query("update institutional_campaigns set brand_snapshot=$2::jsonb,catalog_snapshot=$3::jsonb,artworks='{}'::jsonb,status='rascunho',reviewed_by=null,reviewed_at=null,review_note=null,revision=revision+1,last_edited_by=$4,updated_at=now() where id=$1 and revision=$5 returning id",[id,json(brand),json(item),by,c.revision]);
 if(!rows.length)throw new HttpError(409,'A campanha mudou. Atualize a página.');await record(id,by,'fontes_atualizadas');return getInstitutional(id);
}

const specs: Record<InstitutionFormat, { width: number; height: number; label: string }> = {
  feed: { width: 1080, height: 1080, label: 'Feed Instagram' },
  portrait: { width: 1080, height: 1350, label: 'Retrato 4:5' },
  story: { width: 1080, height: 1920, label: 'Story' },
  banner: { width: 1920, height: 1080, label: 'Banner' },
};
export function getInstitutionalSpecs() { return specs; }
export function institutionalSvg(c: InstitutionalCampaign, f: InstitutionFormat, artworkDataUri?: string): string {
 if(c.renderVersion===1&&!c.designs?.[f])return legacyInstitutionalSvg(c,f,artworkDataUri);
 const commercial=c.catalogItem?`${c.catalogItem.name}${c.catalogItem.priceCents!==null?' — '+new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c.catalogItem.priceCents/100):''}${c.catalogItem.conditions?'. '+c.catalogItem.conditions:''}`:'';
 return renderStudioSvg({brand:c.brand,copies:c.copies,audience:c.input.audience,commercial,format:f,design:StudioDesign.parse(c.designs?.[f]??defaultStudioDesign(c.brand,f)),image:artworkDataUri,fontCss:fontFaces()});
}

/** Loads AI-generated artwork from protected data storage for preview and export. */
export async function renderInstitutionalSvg(c: InstitutionalCampaign, format: InstitutionFormat): Promise<string> {
  const meta = c.artworks[format];
  return institutionalSvg(c, format, meta ? await readArtwork(meta) : undefined);
}

/** Explicit Workers AI image generation using the Cloudflare free quota; never invoked by previews. */
const activeArtwork = new Set<string>();
export async function generateInstitutionalArtwork(id: string, format: InstitutionFormat, by: string) {
  const key = id;
  if (activeArtwork.has(key)) throw new HttpError(409, 'Já existe uma geração em andamento para esta campanha.');
  activeArtwork.add(key);
  try {
    const c = await getInstitutional(id);
    if (!c.input.formats.includes(format)) throw new HttpError(400, 'Formato não selecionado.');
    if (!imageAIStatus().configured) throw new HttpError(503, 'IA gratuita não configurada. Adicione CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN no .env.');
    const { image, model, prompt } = await generateBrandArtwork(c, format);
    const artwork = await storeArtwork(id, format, image, model, prompt);
    // Regeneration invalidates previous approval even if the copy does not change.
    const saved = await db().query(`update institutional_campaigns set artworks=jsonb_set(coalesce(artworks,'{}'::jsonb), $2::text[], $3::jsonb, true),
      status='rascunho',reviewed_by=null,reviewed_at=null,review_note=null,updated_at=now(),
      revision=revision+1,last_edited_by=$4 where id=$1 and revision=$5 returning id`, [id, `{${format}}`, json(artwork), by, c.revision]);
    if (!saved.rows.length) throw new HttpError(409, 'A campanha mudou durante a geração. A versão mais recente foi preservada; confira antes de gerar novamente.');
    await record(id, by, 'arte_ia_gerada', {format, model, promptHash:artwork.promptHash});
    return getInstitutional(id);
  } finally {
    activeArtwork.delete(key);
  }
}

async function assertCatalogCurrent(c:InstitutionalCampaign){
  if(!isDemo()){const liveBrand=(await listBrandProfiles()).find(b=>b.id===c.brandId);if(!liveBrand||JSON.stringify(liveBrand)!==JSON.stringify(BrandProfileSchema.parse(c.brand)))throw new HttpError(409,'A identidade da marca foi alterada. Atualize os dados desta campanha e solicite nova revisão.');}
  if(!c.catalogItem)return;
  const live=(await listBrandCatalog(c.brandId)).find(i=>i.id===c.catalogItem!.id && i.active);
  if(!live || JSON.stringify(live)!==JSON.stringify(BrandCatalogItemSchema.parse(c.catalogItem))) throw new HttpError(409,'O produto ou serviço foi alterado no catálogo. Atualize os dados da campanha e solicite nova revisão antes de exportar.');
}
export async function institutionalZip(c: InstitutionalCampaign, by: string): Promise<Buffer> {
  await assertCatalogCurrent(c);
  if (c.status !== 'aprovada') throw new HttpError(409, 'Campanha precisa de aprovação antes da exportação.');
  const zip = new JSZip();
  for (const f of c.input.formats) {
    const png = await renderInstitutionalPng(await renderInstitutionalSvg(c,f), specs[f].width, specs[f].height);
    zip.file(`${c.brandId}-${f}.png`, png);
  }
  for(const channel of c.input.channels??[]){
    const info=CHANNELS.find(x=>x.id===channel)!;const texts=c.channelTexts[channel];
    for(const f of c.input.formats.filter(f=>(info.formats as readonly string[]).includes(f))){
      zip.file(`canais/${channel}/${c.brandId}-${f}.png`,zip.file(`${c.brandId}-${f}.png`)!.async('nodebuffer'));
    }
    zip.file(`canais/${channel}/texto.txt`,(texts?.subject?`Assunto: ${texts.subject}\n\n`:'')+(texts?.text??c.copies.caption)+'\n');
  }
  zip.file('legenda.txt', c.copies.caption + '\n');
  zip.file('manifest.json', JSON.stringify({ campaignId:c.id, brandId:c.brandId, brandName:c.brand.name,
    sources:'briefing informado e confirmado pelo usuário', aiMode:c.aiMode, formats:c.input.formats,channels:c.input.channels??[],designs:c.designs,channelTexts:c.channelTexts,
    artworkProvenance:Object.fromEntries(c.input.formats.map((f)=>[f,c.artworks[f] ? { source:c.artworks[f]!.source==='uploaded-image'?'imagem enviada pela equipe':'arte gerada por IA',model:c.artworks[f]!.model,promptHash:c.artworks[f]!.promptHash} : {source:'layout vetorial sem imagem IA'}])),
    revision:c.revision, approvedCopy:c.copies, brandSnapshot:c.brand,
    approvedBy:c.reviewedBy, approvedAt:c.reviewedAt, generatedAt:new Date().toISOString(),
    catalogItem:c.catalogItem,
    note:'Revisão humana concluída. Uso condicionado às autorizações da marca.' },null,2));
  const result = await zip.generateAsync({ type:'nodebuffer', compression:'DEFLATE', compressionOptions:{level:6} });
  const current = await getInstitutional(c.id);
  if (current.status !== 'aprovada' || current.revision !== c.revision) throw new HttpError(409, 'A campanha mudou durante a exportação. Revise a versão atual antes de baixar.');
  await assertCatalogCurrent(c);
  await record(c.id, by, 'exportada', {formats:c.input.formats, sizeBytes:result.length, revision:c.revision});
  return result;
}

async function saveStudio(c:InstitutionalCampaign,by:string,sql:string,params:unknown[],action:string){
 const {rows}=await db().query(`update institutional_campaigns set ${sql},status='rascunho',reviewed_by=null,reviewed_at=null,review_note=null,revision=revision+1,last_edited_by=$2,updated_at=now() where id=$1 and revision=$3 returning id`,[c.id,by,c.revision,...params]);
 if(!rows.length)throw new HttpError(409,'A campanha mudou. Atualize antes de salvar suas alterações.');
 await record(c.id,by,action);return getInstitutional(c.id);
}
export async function updateInstitutionalDesign(id:string,format:InstitutionFormat,raw:unknown,by:string){
 const parsed=z.object({baseRevision:z.number().int().positive(),design:StudioDesign,copies:CopySchema.optional()}).parse(raw);
 const c=await getInstitutional(id);assertRevision(c,parsed.baseRevision);if(!c.input.formats.includes(format))throw new HttpError(400,'Formato não selecionado.');
 if(parsed.copies)assertCommercialCopy(parsed.copies,c.catalogItem);
 return saveStudio(c,by,'render_version=2,designs=jsonb_set(designs,$4::text[],$5::jsonb,true),copies=$6::jsonb',[[format],json(parsed.design),json(parsed.copies??c.copies)],'arte_editada_manualmente');
}
export async function updateInstitutionalDistribution(id:string,raw:unknown,by:string){
 const p=z.object({baseRevision:z.number().int().positive(),channels:z.array(ChannelId).min(1).max(6).refine(a=>new Set(a).size===a.length),formats:z.array(InstitutionFormat).min(1).max(4).refine(a=>new Set(a).size===a.length),channelTexts:ChannelTexts.default({})}).parse(raw);
 const c=await getInstitutional(id);assertRevision(c,p.baseRevision);
 for(const channel of p.channels){const info=CHANNELS.find(x=>x.id===channel)!;if(!p.formats.some(f=>(info.formats as readonly string[]).includes(f)))throw new HttpError(400,`Selecione um formato compatível com ${info.label}.`);}
 for(const f of p.formats)if(!CHANNELS.some(c=>p.channels.includes(c.id)&&(c.formats as readonly string[]).includes(f)))throw new HttpError(400,'Há formato sem canal de destino.');
 for(const text of Object.values(p.channelTexts))assertCommercialCopy({...c.copies,subtitle:text.text,caption:text.subject??''},c.catalogItem);
 return saveStudio(c,by,'data=$4::jsonb,channel_texts=$5::jsonb',[json({...c.input,channels:p.channels,formats:p.formats}),json(Object.fromEntries(Object.entries(p.channelTexts).filter(([k])=>p.channels.includes(k as ChannelId))))],'canais_atualizados');
}
export async function uploadInstitutionalBackground(id:string,format:InstitutionFormat,raw:unknown,file:Express.Multer.File|undefined,by:string){
 const {baseRevision}=z.object({baseRevision:z.coerce.number().int().positive()}).parse(raw);const c=await getInstitutional(id);assertRevision(c,baseRevision);
 if(!c.input.formats.includes(format))throw new HttpError(400,'Formato não selecionado.');
 if(!file||!['image/png','image/jpeg'].includes(file.mimetype))throw new HttpError(400,'Envie uma imagem PNG ou JPEG de até 5 MB.');
 // The signature check also rejects files merely renamed to .png or .jpg.
 let image:Buffer;try{image=verifyGeneratedImage(file.buffer.toString('base64'));}catch{throw new HttpError(400,'O arquivo não é uma imagem PNG ou JPEG válida.');}
 const artwork=await storeArtwork(id,format,image,'arquivo-da-equipe','Imagem enviada pela equipe','uploaded-image');
 return saveStudio(c,by,'artworks=jsonb_set(artworks,$4::text[],$5::jsonb,true)',[[format],json(artwork)],'imagem_enviada');
}
