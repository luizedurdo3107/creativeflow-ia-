import type { StudioDesign, ChannelId, ChannelTextMap } from '@cf/shared';
import type {
  Briefing,
  Concept,
  CreativeDoc,
  CreativeStatus,
  DiffEntry,
  FormatId,
  Offer,
  PatchOp,
  Praca,
  Product,
  RejectedOp,
  RulesConfig,
  RuleDefinition,
  Segment,
  SemanticCheck,
  SemanticText,
  UserRole,
  ValidationReport,
  VersionOrigin,
} from '@cf/shared';

/* ------------------------------ Tipos ----------------------------- */
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}
export interface AppConfig {appMode:'product'|'demo';setupRequired:boolean;freeOnly:boolean;}
export interface UsageStatus {day:string;resetAt:string;freeOnly:boolean;images:{used:number;limit:number};text:{used:number;limit:number};note:string;}
export interface TeamMember extends User {active:boolean;owner:boolean;}
export interface SystemStatus {
  appMode:'product'|'demo';freeOnly:boolean;usage:UsageStatus;
  ai: { provider: string; mode: 'ia-generativa' | 'demonstracao' | 'nao-configurada'; requested: string };
  imageAI: {provider:string;model:string;configured:boolean;mode:string};
  db: string;
  today: string;
  brandVersion: string;
  rulesVersion: string;
}
export interface ContextBundle {
  products: Record<string, Product>;
  offersByPraca: Record<string, Record<string, Offer | undefined>>;
  pracas: Praca[];
  today: string;
  legal: { mipWarning: string };
  campaign: { startsAt: string; endsAt: string; name: string };
}
export interface VersionDTO {
  id: string;
  number: number;
  origin: VersionOrigin;
  conceptId: string | null;
  authorId: string;
  instruction: string | null;
  status: CreativeStatus;
  createdAt: string;
  diff: DiffEntry[];
  rejected: RejectedOp[];
  validation: ValidationReport | null;
  doc: CreativeDoc;
}
export interface CreativeDTO {
  id: string;
  campaignId: string;
  format: FormatId;
  praca: string;
  segmentId: string;
  skus: string[];
  status: CreativeStatus;
  exceptionReason: string | null;
  updatedAt: string;
  current: VersionDTO | null;
}
export interface ConceptDTO {
  id: string;
  campaignId: string;
  number: number;
  data: Concept;
  source: string;
  status: 'proposto' | 'aprovado' | 'substituido' | 'reprovado';
  createdBy: string;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
}
export interface CampaignDTO {
  id: string;
  name: string;
  briefing: Briefing;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  firstExportAt: string | null;
}
export interface CampaignOverview {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  firstExportAt: string | null;
  briefing: Briefing;
  total: number;
  byStatus: Partial<Record<CreativeStatus, number>>;
}
export interface CampaignDetail {
  campaign: CampaignDTO;
  concept: ConceptDTO | null;
  concepts: ConceptDTO[];
  creatives: CreativeDTO[];
  context: ContextBundle;
  exports: { id: string; fileName: string; count: number; createdAt: string; createdBy: string; blocked: number }[];
}
export interface AuditEvent {
  id: string;
  campaignId: string | null;
  creativeId: string | null;
  versionId: string | null;
  actorId: string | null;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}
export interface Review {
  id: string;
  creativeId: string | null;
  versionId: string | null;
  conceptId: string | null;
  reviewerId: string;
  decision: 'aprovado' | 'ajustes' | 'reprovado';
  comment: string | null;
  createdAt: string;
}
export type SemanticDTO = (SemanticCheck & { texts: SemanticText[]; source?: 'conceito' | 'versao' }) | null;

export interface CritiqueDTO {
  id: string;
  provider: string;
  fallback?: boolean;
  error?: string;
  score: number;
  summary: string;
  strengths: string[];
  issues: { severity: 'baixa' | 'media' | 'alta'; text: string }[];
  suggestions: { text: string; instruction: string }[];
}
export interface CreativeDetail {
  creative: CreativeDTO;
  versions: VersionDTO[];
  reviews: Review[];
  audit: AuditEvent[];
  critique: { id: string; provider: string; data: Omit<CritiqueDTO, 'id' | 'provider'>; createdAt: string } | null;
  context: ContextBundle;
  concept: ConceptDTO | null;
}
export interface Proposal {
  proposalId: string;
  status: 'pendente' | 'recusada';
  summary: string;
  ops: PatchOp[];
  rejected: RejectedOp[];
  refusal: { category: string; message: string } | null;
  provider: string;
  fallback: boolean;
  error?: string;
  ms?: number;
  previewDoc: CreativeDoc | null;
  diff: DiffEntry[];
  validation: ValidationReport | null;
}
export interface PreviewResult {
  totalPieces: number;
  breakdown: { pracas: number; segments: number; products: number; singleFormats: number; multiFormats: number };
  issues: { severity: 'critico' | 'alerta'; praca?: string; sku?: string; message: string }[];
}
export interface Metrics {
  campaign: { id: string; name: string; createdAt: string; firstExportAt: string | null };
  pieces: { total: number; byStatus: Partial<Record<CreativeStatus, number>>; byFormat: Record<string, number>; approved: number; inherited: number; inheritedRate: number };
  effort: { humanDecisions: number; piecesPerHumanDecision: number | null; generationSeconds: number; briefingToFirstExportMinutes: number | null };
  governance: Record<string, number>;
  gain: { baselineMinutesPerPiece: number | null; baselineNote: string; manualProjectionMinutes: number | null; measuredMinutes: number | null; multiplier: number | null };
}
export interface Learning {
  id: string;
  text: string;
  source: string;
  status: 'sugerida' | 'ativa' | 'descartada';
  createdBy: string;
  decidedBy: string | null;
  createdAt: string;
}
export interface QueueResponse {
  concepts: (ConceptDTO & { campaignName: string; pending: number })[];
  items: { creative: CreativeDTO; campaign: { id: string; name: string } | null; baseVersion: { id: string; number: number; doc: CreativeDoc } | null }[];
  contexts: Record<string, ContextBundle>;
}
export interface ImportReport {
  total: number;
  valid: number;
  errors: { line: number; message: string }[];
  offers: Offer[];
  saved: boolean;
  reevaluated?: number;
}

export interface BrandProfile {
  id: string;
  name: string;
  description: string;
  website?: string;
  logoUrl?: string;
  logoDataUri?: string;
  colors: string[];
  tone: string;
  fontFamily?: 'Inter' | 'Poppins' | 'Nunito' | 'Arial';
  guidelines: string;
}

export interface BrandCatalogItem {id:string;kind:'produto'|'servico';name:string;description:string;priceCents:number|null;conditions:string;sourceNotes:string;active:boolean;}
export interface BrandCatalogImport {total:number;valid:number;errors:{line:number;message:string}[];items:BrandCatalogItem[];saved:boolean;}

export type InstitutionalFormat = 'feed' | 'portrait' | 'story' | 'banner';
export interface InstitutionalInput {
  catalogItemId?: string; brandId: string; name: string; objective: string; audience: string; keyMessage: string;
  copyMode?:'ai'|'briefing'; cta: string; sourceNotes: string; artDirection?: string; formats: InstitutionalFormat[]; channels?:ChannelId[]; confirmed: boolean;
}
export interface InstitutionalCopy { headline: string; subtitle: string; caption: string; cta: string; }
export interface InstitutionalCampaign {
  id: string; brandId: string; brand: BrandProfile; name: string; input: InstitutionalInput;
  renderVersion:number; designs:Partial<Record<InstitutionalFormat,StudioDesign>>; channelTexts:ChannelTextMap;
  catalogItem: BrandCatalogItem|null; copies: InstitutionalCopy; aiMode: string; artworks: Partial<Record<InstitutionalFormat,{ filename:string; model:string; createdAt:string; promptHash:string; source:string }>>; status: 'rascunho'|'em_revisao'|'aprovada'|'reprovada';
  revision: number; lastEditedBy: string; createdBy: string; reviewedBy: string|null; reviewNote: string|null;
  createdAt: string; updatedAt: string; reviewedAt: string|null;
}

/* ------------------------------ Cliente --------------------------- */
const TOKEN_KEY = 'cf.token';
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return memToken;
  }
}
let memToken: string | null = null;
export function setToken(t: string | null) {
  memToken = t;
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* armazenamento indisponível: mantém em memória */
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function req<T>(method: string, path: string, body?: unknown, isForm = false): Promise<T> {
  const headers: Record<string, string> = {'x-cf-client':'creativeflow-web'};
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined && !isForm) headers['content-type'] = 'application/json';
  const res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body) });
  if (res.status === 401 && !path.startsWith('/auth') && path!=='/me') {
    setToken(null);
    if (!location.pathname.startsWith('/entrar')) location.href = '/entrar';
  }
  const ct = res.headers.get('content-type') ?? '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Erro ${res.status}`, (data as { details?: unknown }).details);
  return data as T;
}

async function download(path: string, fallbackName: string) {
  const res = await fetch(`/api${path}`, { headers: { authorization: `Bearer ${getToken()}` } });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (d as { error?: string }).error ?? 'Download bloqueado.');
  }
  const blob = await res.blob();
  const name = res.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const api = {
  backupWorkspace:()=>download('/workspace/backup','creativeflow-backup.zip'),
  authConfig:()=>req<AppConfig>('GET','/auth/config'),
  passwordLogin:(email:string,password:string)=>req<{user:User}>('POST','/auth/login',{email,password}),
  setupAccount:(name:string,email:string,password:string)=>req<{user:User}>('POST','/auth/setup',{name,email,password}),
  acceptInvitation:(token:string,password:string)=>req<{user:User}>('POST','/auth/accept',{token,password}),
  logout:()=>req<{ok:boolean}>('POST','/auth/logout',{}),
  changePassword:(currentPassword:string,newPassword:string)=>req<{user:User}>('POST','/account/password',{currentPassword,newPassword}),
  team:()=>req<TeamMember[]>('GET','/team'),
  inviteMember:(data:{name:string;email:string;role:User['role'];reset?:boolean})=>req<{url:string;expiresInHours:number}>('POST','/team/invitations',data),
  updateMember:(id:string,data:{role:User['role'];active:boolean})=>req<{ok:boolean}>('PATCH',`/team/${id}`,data),
  usage:()=>req<UsageStatus>('GET','/system/usage'),
  users: () => req<User[]>('GET', '/auth/users'),
  login: (userId: string) => req<{ token: string; user: User }>('POST', '/auth/login', { userId }),
  me: () => req<User>('GET', '/me'),
  status: () => req<SystemStatus>('GET', '/system/status'),
  updateInstitutionalDesign:(id:string,format:InstitutionalFormat,design:StudioDesign,copies:InstitutionalCopy,baseRevision:number)=>req<InstitutionalCampaign>('PATCH',`/institutional/${id}/design/${format}`,{design,copies,baseRevision}),
  updateInstitutionalDistribution:(id:string,channels:ChannelId[],formats:InstitutionalFormat[],channelTexts:ChannelTextMap,baseRevision:number)=>req<InstitutionalCampaign>('PATCH',`/institutional/${id}/distribution`,{channels,formats,channelTexts,baseRevision}),
  uploadInstitutionalBackground:(id:string,format:InstitutionalFormat,file:File,baseRevision:number)=>{const data=new FormData();data.append('file',file);data.append('baseRevision',String(baseRevision));return req<InstitutionalCampaign>('POST',`/institutional/${id}/background/${format}`,data,true);},
  updateInstitutionalBriefing:(id:string,input:InstitutionalInput,baseRevision:number)=>req<InstitutionalCampaign>('PATCH',`/institutional/${id}/briefing`,{input,baseRevision}),
  submitInstitutional:(id:string,baseRevision:number)=>req<InstitutionalCampaign>('POST',`/institutional/${id}/submit`,{baseRevision}),
  archiveInstitutional:(id:string)=>req<{ok:boolean}>('POST',`/institutional/${id}/archive`,{}),
  archivedInstitutional:()=>req<InstitutionalCampaign[]>('GET','/institutional/archived'),
  restoreArchivedInstitutional:(id:string)=>req<InstitutionalCampaign>('POST',`/institutional/${id}/restore-archive`,{}),
  syncInstitutionalReferences:(id:string,baseRevision:number)=>req<InstitutionalCampaign>('POST',`/institutional/${id}/sync-references`,{baseRevision}),
  institutional: () => req<InstitutionalCampaign[]>('GET', '/institutional'),
  createInstitutional: (data: InstitutionalInput) => req<InstitutionalCampaign>('POST', '/institutional', data),
  getInstitutional: (id: string) => req<InstitutionalCampaign>('GET', `/institutional/${id}`),
  institutionalAudit: (id: string) => req<{actorId:string;actorName?:string;action:string;details:Record<string,unknown>;createdAt:string}[]>('GET',`/institutional/${id}/audit`),
  generateInstitutional: (id: string, baseRevision: number) => req<InstitutionalCampaign>('POST', `/institutional/${id}/generate`, {baseRevision}),
  proposeInstitutionalEdit: (id: string, instruction: string, baseRevision: number) => req<{copy:InstitutionalCopy;baseRevision:number;provider:string}>('POST', `/institutional/${id}/ai-edit`, {instruction,baseRevision}),
  generateInstitutionalArt: (id: string, format: InstitutionalFormat, secret: string) => {
    const token = getToken();
    return fetch(`/api/institutional/${id}/art/${format}`,{method:'POST',headers:{
      ...(token ? {authorization:`Bearer ${token}`} : {}),
      'x-image-generation-secret':secret,'x-cf-client':'creativeflow-web',
    }}).then(async (res) => {
      const payload = await res.json() as InstitutionalCampaign & {error?:string};
      if (!res.ok) throw new ApiError(res.status,payload.error || `Falha HTTP ${res.status}`);
      return payload;
    });
  },
  updateInstitutionalCopy: (id: string, data: Partial<InstitutionalCopy> & {baseRevision?:number}) => req<InstitutionalCampaign>('PATCH', `/institutional/${id}/copy`, data),
  reviewInstitutional: (id: string, decision: 'aprovada'|'reprovada', note: string, baseRevision: number) => req<InstitutionalCampaign>('POST', `/institutional/${id}/review`, {decision,note,baseRevision}),
  previewInstitutional: (id: string, format: InstitutionalFormat) => req<{svg: string; status: string}>('GET', `/institutional/${id}/preview/${format}`),
  exportInstitutional: (id: string) => download(`/institutional/${id}/export`, `${id}-aprovado.zip`),
  brandCatalog:(brandId:string)=>req<BrandCatalogItem[]>('GET',`/brands/${brandId}/catalog`),
  saveBrandCatalogItem:(brandId:string,item:BrandCatalogItem)=>req<BrandCatalogItem>('PUT',`/brands/${brandId}/catalog`,item),
  importBrandCatalog:(brandId:string,file:File,dryRun:boolean)=>{const data=new FormData();data.append('file',file);return req<BrandCatalogImport>('POST',`/brands/${brandId}/catalog/import?dryRun=${dryRun?1:0}`,data,true);},
  downloadBrandCatalogTemplate:(brandId:string)=>download(`/brands/${brandId}/catalog/template.csv`,'catalogo-marca.csv'),
  brandProfiles: () => req<BrandProfile[]>('GET', '/system/brand-profiles'),
  saveBrandProfile: (profile: BrandProfile) => req<BrandProfile>('PUT', '/system/brand-profiles', profile),
  brand: () => req<{ version: string; colors: Record<string, string>; fonts: Record<string, { family: string }>; voice: { name: string; tone: string[]; doExamples: string[]; dontExamples: string[] }; rules: RuleDefinition[] }>('GET', '/system/brand'),

  catalog: () => req<{ products: Product[]; pracas: Praca[]; segments: Segment[] }>('GET', '/catalog'),
  offers: (praca?: string) => req<(Offer & { source: string; updatedAt: string })[]>('GET', `/offers${praca ? `?praca=${praca}` : ''}`),
  importOffers: (file: File, dryRun: boolean) => {
    const f = new FormData();
    f.append('file', file);
    return req<ImportReport>('POST', `/offers/import?dryRun=${dryRun ? 1 : 0}`, f, true);
  },
  downloadOffers: () => download('/offers/template.csv', 'ofertas.csv'),

  campaigns: () => req<CampaignOverview[]>('GET', '/campaigns'),
  preview: (b: unknown) => req<PreviewResult>('POST', '/campaigns/preview', b),
  createCampaign: (b: unknown) => req<CampaignDTO>('POST', '/campaigns', b),
  campaign: (id: string) => req<CampaignDetail>('GET', `/campaigns/${id}`),
  generateConcept: (id: string, feedback?: string) => req<{ concept: ConceptDTO; ai: { provider: string; fallback: boolean; ms: number; examples?: number } }>('POST', `/campaigns/${id}/concept/generate`, { feedback }),
  editConcept: (id: string, data: Concept) => req<ConceptDTO>('PUT', `/campaigns/${id}/concept`, data),
  generatePieces: (id: string) => req<{ total: number; created: number; updated: number; kept: number; statusCounts: Record<string, number>; ms: number }>('POST', `/campaigns/${id}/generate`, {}),
  revalidate: (id: string) => req<{ statusCounts: Record<string, number> }>('POST', `/campaigns/${id}/revalidate`, {}),
  audit: (id: string) => req<AuditEvent[]>('GET', `/campaigns/${id}/audit`),
  metrics: (id: string) => req<Metrics>('GET', `/campaigns/${id}/metrics`),
  exportCampaign: (id: string, body: { creativeIds?: string[]; pracas?: string[]; formats?: string[] }) =>
    req<{ exportId: string; fileName: string; count: number; blocked: { creativeId: string; file: string; status: string; reason: string }[] }>('POST', `/campaigns/${id}/export`, body),
  downloadExport: (exportId: string) => download(`/exports/${exportId}/download`, 'exportacao.zip'),

  creative: (id: string) => req<CreativeDetail>('GET', `/creatives/${id}`),
  manualEdit: (id: string, baseVersionId: string, ops: PatchOp[]) => req<{ version: VersionDTO; rejected: RejectedOp[] }>('PATCH', `/creatives/${id}/layers`, { baseVersionId, ops }),
  proposeAi: (id: string, instruction: string, scope: 'piece' | 'siblings') => req<Proposal>('POST', `/creatives/${id}/ai-edits`, { instruction, scope }),
  applyAi: (proposalId: string) => req<{ version: VersionDTO; replicated: { creativeId: string; praca: string; versionNumber: number; status: string }[] }>('POST', `/ai-edits/${proposalId}/apply`, {}),
  discardAi: (proposalId: string) => req<{ ok: true }>('POST', `/ai-edits/${proposalId}/discard`, {}),
  restore: (id: string, versionId: string) => req<{ version: VersionDTO }>('POST', `/creatives/${id}/restore`, { versionId }),
  validate: (id: string) => req<{ status: CreativeStatus; reason: string | null; validation: ValidationReport }>('POST', `/creatives/${id}/validate`, {}),
  semanticConcept: (campaignId: string) => req<SemanticDTO>('GET', `/campaigns/${campaignId}/semantic`),
  semanticCreative: (creativeId: string) => req<SemanticDTO>('GET', `/creatives/${creativeId}/semantic`),
  dismissSemantic: (hash: string, findingId: string, reason: string, campaignId: string) => req<{ statusCounts: Record<string, number> }>('POST', `/semantic/${hash}/dismiss`, { findingId, reason, campaignId }),
  critique: (id: string) => req<CritiqueDTO & { versionId: string }>('POST', `/creatives/${id}/critique`, {}),
  downloadPng: (id: string) => download(`/creatives/${id}/png`, 'peca.png'),

  queue: () => req<QueueResponse>('GET', '/reviews/queue'),
  reviewConcept: (id: string, decision: 'aprovado' | 'reprovado', comment?: string, suggestLearning?: boolean) => req<{ statusCounts: Record<string, number> }>('POST', `/concepts/${id}/review`, { decision, comment, suggestLearning }),
  reviewCreative: (id: string, versionId: string, decision: 'aprovado' | 'ajustes', comment?: string, suggestLearning?: boolean) =>
    req<{ status: CreativeStatus }>('POST', `/creatives/${id}/review`, { versionId, decision, comment, suggestLearning }),
  batchApprove: (creativeIds: string[]) => req<{ creativeId: string; ok: boolean; error?: string }[]>('POST', '/reviews/batch-approve', { creativeIds }),

  rules: () => req<{ config: RulesConfig; catalog: RuleDefinition[] }>('GET', '/admin/rules'),
  updateRules: (patch: Partial<RulesConfig>) => req<RulesConfig>('PUT', '/admin/rules', patch),
  settings: () => req<{ today: string; baseline: { minutesPerPiece: number | null; note: string } }>('GET', '/admin/settings'),
  updateSettings: (body: { simulatedToday?: string | null; baseline?: { minutesPerPiece: number | null; note: string } }) => req<{ today: string }>('PUT', '/admin/settings', body),
  learnings: () => req<Learning[]>('GET', '/learnings'),
  addLearning: (text: string) => req<{ id: string }>('POST', '/learnings', { text }),
  decideLearning: (id: string, status: 'ativa' | 'descartada') => req<{ ok: true }>('POST', `/learnings/${id}/decision`, { status }),
  resetDemo: () => req<{ ok: true }>('POST', '/admin/reset-demo', {}),
};
