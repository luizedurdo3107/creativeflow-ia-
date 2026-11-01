import { defaultStudioDesign } from '@cf/shared';
/** FREE_CLOUDFLARE_V1: Image generation using Cloudflare Workers AI.
 * The model generates only an illustrative background. Approved logos, brand
 * colors and copy are composited by CreativeFlow, not entrusted to the model.
 * Never expose a Cloudflare token to the browser.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { reserveAICall } from './usage.service';
import { credentialProvided, env, isDemo } from '../config/env';
import { HttpError } from '../utils/errors';
import type { BrandProfile } from './brand-profiles.service';
import type { InstitutionalCampaign, InstitutionFormat } from './institutional.service';

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([137,80,78,71,13,10,26,10]);
const FILE_PATTERN = /^inst_[a-zA-Z0-9_-]+-(feed|portrait|story|banner)-[a-f0-9]{24}\.(png|jpg)$/;
const MODEL = '@cf/black-forest-labs/flux-1-schnell';

export interface ArtworkMeta {
  filename: string;
  model: string;
  createdAt: string;
  promptHash: string;
  source: 'cloudflare-workers-ai' | 'openai-images' | 'uploaded-image'; // preserves pre-migration campaigns
}

export function imageAIStatus() {
  const configured = [env.cloudflare.accountId,env.cloudflare.token,...(isDemo()?[env.image.generationSecret]:[])].every(credentialProvided) && env.image.enabled;
  return {
    provider: 'cloudflare-workers-ai',
    model: MODEL,
    configured,
    mode: configured ? 'geracao-real' : 'nao-configurado',
    plan: 'free-tier-com-limite-diario',
  };
}

export function verifyGenerationSecret(secret: string): boolean {
  if (!secret || !env.image.generationSecret) return false;
  const actual = createHash('sha256').update(secret).digest();
  const expected = createHash('sha256').update(env.image.generationSecret).digest();
  return timingSafeEqual(actual, expected);
}

export function buildBrandArtworkPrompt(c: InstitutionalCampaign, format: InstitutionFormat) {
  const brand: BrandProfile = c.brand;
  const design=c.designs?.[format]??defaultStudioDesign(brand,format);
  const educational=/educa|aprend|escola|ensino/i.test(brand.description+' '+c.input.objective);
  const subject=design.imageSubject||(educational?'A beautifully styled contemporary learning workspace, unbranded closed books, a blank-screen tablet, natural materials, soft window light.':'An elegant architectural still life with sculptural forms, natural materials and soft directional light.');
  const style={photo:'Premium editorial photography, realistic materials, natural light, subtle depth of field. No cartoon or flat clipart.',illustration:'Refined dimensional editorial illustration, carefully composed tactile shapes, soft studio lighting, sophisticated details.',abstract:'Sophisticated abstract composition with sculptural forms, balanced negative space, tactile materials and soft shadows.'}[design.imageStyle];
  return [
    'Create one polished editorial image. This is an image asset, NOT an advertisement, poster, website or graphic layout.',
    `STYLE: ${style}`,
    `SUBJECT: ${subject.slice(0,500)}`,
    `Use subtle accents from this palette: ${brand.colors.join(', ')}. Avoid a flat full-frame brand-color gradient.`,
    `USER ART DIRECTION: ${(c.input.artDirection||'Clean, accessible, high quality editorial composition').slice(0,180)}`,
    'Balanced composition with a clear focal subject and room around it for cropping. The app will place this image in its own frame, separate from the copy.',
    'No letters, no text, no numbers, no watermarks, no signatures, no logos, no UI, no charts. All text and approved logos are added separately by the app.',
    'Do not invent a product screenshot, partners, certificates, testimonials or quantitative claims.',
  ].join('\n');
}

function detectMime(image: Buffer): 'image/png' | 'image/jpeg' {
  if (image.length >= 16 && image.subarray(0, 8).equals(PNG_SIGNATURE) && image.toString('ascii',12,16) === 'IHDR') return 'image/png';
  if (image.length >= 8 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff && image[image.length - 2] === 0xff && image[image.length - 1] === 0xd9) return 'image/jpeg';
  throw new HttpError(502, 'O provedor retornou um formato inválido; esperado PNG ou JPEG.');
}

export function verifyGeneratedImage(raw: string): Buffer {
  if (raw.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) throw new HttpError(502, 'Imagem de IA inválida ou maior que o limite de 15 MB.');
  const image = Buffer.from(raw, 'base64');
  if (image.length < 100 || image.length > MAX_IMAGE_BYTES) throw new HttpError(502, 'Imagem de IA vazia ou maior que o limite de 15 MB.');
  detectMime(image);
  return image;
}
/** Compatibilidade com testes da integração anterior. */
export const verifyGeneratedPng = verifyGeneratedImage;

export function safeArtworkPath(filename: string): string {
  if (!FILE_PATTERN.test(filename)) throw new HttpError(500, 'Arquivo de arte inválido.');
  return resolve(env.dataDir, 'ai-artworks', filename);
}

export async function readArtwork(meta: ArtworkMeta): Promise<string> {
  try {
    const image = await readFile(safeArtworkPath(meta.filename));
    const mime = detectMime(image);
    return `data:${mime};base64,${image.toString('base64')}`;
  } catch {
    throw new HttpError(409, 'A arte IA não está no armazenamento. Restaure o volume de dados ou regenere antes de exportar.');
  }
}

export async function storeArtwork(campaignId: string, format: InstitutionFormat, image: Buffer, model: string, prompt: string, source:ArtworkMeta['source']='cloudflare-workers-ai'): Promise<ArtworkMeta> {
  const mime = detectMime(image);
  const dir = resolve(env.dataDir, 'ai-artworks');
  await mkdir(dir, { recursive: true });
  const hash = createHash('sha256').update(image).digest('hex').slice(0, 24);
  const filename = `${campaignId}-${format}-${hash}.${mime === 'image/png' ? 'png' : 'jpg'}`;
  const full = safeArtworkPath(filename);
  const tmp = `${full}.tmp-${process.pid}`;
  await writeFile(tmp, image, { flag: 'w', mode: 0o600 });
  await rename(tmp, full);
  return {
    filename, model, source, createdAt: new Date().toISOString(),
    promptHash: createHash('sha256').update(prompt).digest('hex'),
  };
}

/** Only Cloudflare Workers AI is called. No paid OpenAI Images API calls. */
export async function generateBrandArtwork(c: InstitutionalCampaign, format: InstitutionFormat): Promise<{image:Buffer; model:string; prompt:string}> {
  if (!imageAIStatus().configured) throw new HttpError(503, 'Configure CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN e IMAGE_GENERATION_SECRET no .env. A conta Cloudflare Workers AI Free possui limite diário.');
  await reserveAICall('image');
  const prompt = buildBrandArtworkPrompt(c, format);
  // FLUX.1 Schnell delivers JPEG by default; the SVG compositor adapts/crops to the target format.
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.cloudflare.accountId)}/ai/run/${MODEL}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method:'POST',
      headers:{'content-type':'application/json', authorization:`Bearer ${env.cloudflare.token}`},
      body:JSON.stringify({prompt,steps:4}),
      signal:AbortSignal.timeout(env.image.timeoutMs),
    });
  } catch (error) {
    throw new HttpError(502, `Falha de conexão com Cloudflare Workers AI: ${error instanceof Error ? error.message.slice(0,120) : 'erro de rede'}`);
  }
  if (!response.ok) {
    if ([401,403].includes(response.status)) throw new HttpError(502, 'Token Cloudflare inválido ou sem permissões Workers AI.');
    if (response.status === 429 || response.status === 402) throw new HttpError(429, 'Cota diária gratuita ou limite de requisições da Cloudflare atingido. Tente no próximo ciclo.');
    throw new HttpError(502, `Cloudflare Workers AI recusou a geração (HTTP ${response.status}).`);
  }
  let json: {success?:boolean;result?:{image?:string}; errors?:unknown};
  try { json = await response.json() as typeof json; }
  catch { throw new HttpError(502, 'A Cloudflare não retornou JSON válido.'); }
  const raw = json.result?.image;
  if (!json.success || typeof raw !== 'string') throw new HttpError(502, 'A Cloudflare não retornou a imagem. Verifique a cota e o modelo habilitado.');
  return {image:verifyGeneratedImage(raw),model:MODEL,prompt};
}
