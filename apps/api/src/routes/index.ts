import { backupWorkspace } from '../services/backup.service';
import { env, isDemo } from '../config/env';
import { authConfig, setupAccount, passwordLogin, logoutAccount, changePassword, teamMembers, inviteMember, acceptInvitation, updateMember, rateLimitAuth } from '../services/accounts.service';
import { usageStatus } from '../services/usage.service';
import { listBrandCatalog, saveBrandCatalogItem, importBrandCatalog } from '../services/brand-catalog.service';
import { Router } from 'express';
import { z } from 'zod';
import { createInstitutional, updateInstitutionalDesign, updateInstitutionalDistribution, uploadInstitutionalBackground, updateInstitutionalBriefing, submitInstitutional, archiveInstitutional, archivedInstitutional, restoreArchivedInstitutional, syncInstitutionalReferences, getInstitutional, getInstitutionalAudit, listInstitutional, proposeInstitutionalEdit, regenerateInstitutional, updateInstitutionalCopy, reviewInstitutional, renderInstitutionalSvg, generateInstitutionalArtwork, institutionalZip, InstitutionFormat } from '../services/institutional.service';
import multer from 'multer';
import { verifyGenerationSecret } from '../services/image-ai.service';
import { HttpError } from '../utils/errors';
import {
  AdminController as Admin,
  AuthController as Auth,
  CampaignController as Campaign,
  CatalogController as Catalog,
  CreativeController as Creative,
  ReviewController as Review,
  SystemController as System,
} from '../controllers';
import { authenticate, requireRole } from '../middleware/auth';
import { ah } from '../middleware/error';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const CRIA = requireRole('criador');
const REVISA = requireRole('revisor');
const ADMIN = requireRole('admin');

export function apiRouter(): Router {
  const r = Router();

  // públicas
  r.get('/health', (_req, res) => res.json({ ok: true }));
  r.get('/auth/config',ah(async(_req,res)=>res.json(await authConfig())));
  r.use('/auth',(req,_res,next)=>{try{if(req.method==='POST'&&!isDemo())rateLimitAuth('ip:'+req.ip);next();}catch(e){next(e);}});
  r.get('/auth/users',ah(async(req,res)=>{if(!isDemo())throw new HttpError(404,'Entre com e-mail e senha.');return Auth.users(req,res);}));
  r.post('/auth/login',ah(async(req,res)=>{if(isDemo())return Auth.login(req,res);res.json(await passwordLogin(req.body,res));}));
  r.post('/auth/setup',ah(async(req,res)=>{if(!env.allowRemoteSetup&&!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress??''))throw new HttpError(403,'Configure a primeira conta no computador do servidor.');res.status(201).json(await setupAccount(req.body,res));}));
  r.post('/auth/accept',ah(async(req,res)=>{if(isDemo())throw new HttpError(404,'Não disponível.');res.json(await acceptInvitation(req.body,res));}));
  r.post('/auth/logout',ah(async(req,res)=>res.json(await logoutAccount(req,res))));

  r.use(ah(authenticate));
  r.get('/me', ah(Auth.me));
  r.post('/account/password',ah(async(req,res)=>res.json(await changePassword(req.body,req.user!.id,res))));
  r.get('/team',ADMIN,ah(async(_req,res)=>res.json(await teamMembers())));
  r.post('/team/invitations',ADMIN,ah(async(req,res)=>res.status(201).json(await inviteMember(req.body,req.user!.id))));
  r.patch('/team/:id',ADMIN,ah(async(req,res)=>res.json(await updateMember(req.params.id,req.body,req.user!.id))));
  r.get('/workspace/backup',ADMIN,ah(async(_req,res)=>{res.type('application/zip').attachment('creativeflow-backup-'+new Date().toISOString().slice(0,10)+'.zip').send(await backupWorkspace());}));
  r.get('/system/usage',ah(async(_req,res)=>res.json(await usageStatus())));
  r.get('/system/status', ah(System.status));
  r.get('/system/brand',ah(async(req,res)=>{if(!isDemo())throw new HttpError(404,'Configure a identidade visual em Marcas.');return System.brand(req,res);}));
  r.get('/system/brand-profiles', ah(System.brands));
  r.put('/system/brand-profiles', ADMIN, ah(System.saveBrand));

  r.get('/brands/:brandId/catalog',ah(async(req,res)=>{res.json(await listBrandCatalog(req.params.brandId));}));
  r.put('/brands/:brandId/catalog',ADMIN,ah(async(req,res)=>{res.json(await saveBrandCatalogItem(req.params.brandId,req.body));}));
  r.get('/brands/:brandId/catalog/template.csv',ah(async(req,res)=>{
    await listBrandCatalog(req.params.brandId);
    res.type('text/csv; charset=utf-8').attachment('catalogo-marca.csv').send('\uFEFFid;tipo;nome;descricao;preco;condicoes;fonte;ativo\n');
  }));
  r.post('/brands/:brandId/catalog/import',ADMIN,upload.single('file'),ah(async(req,res)=>{
    if(!req.file) throw new HttpError(400,'Selecione um arquivo CSV ou XLSX.');
    res.json(await importBrandCatalog(req.params.brandId,req.file.buffer,req.file.originalname,req.query.dryRun!=='0'));
  }));

  // Campanhas institucionais: marcas reais sem herdar o regulamento farmacêutico.
  r.get('/institutional', ah(async (_req, res) => { res.json(await listInstitutional()); }));
  r.post('/institutional', CRIA, ah(async (req, res) => {
    res.status(201).json(await createInstitutional(req.body, req.user!.id));
  }));
  r.get('/institutional/archived',ah(async(_req,res)=>res.json(await archivedInstitutional())));
  r.patch('/institutional/:id/briefing',CRIA,ah(async(req,res)=>res.json(await updateInstitutionalBriefing(req.params.id,req.body,req.user!.id))));
  r.post('/institutional/:id/submit',CRIA,ah(async(req,res)=>res.json(await submitInstitutional(req.params.id,req.body,req.user!.id))));
  r.post('/institutional/:id/archive',CRIA,ah(async(req,res)=>res.json(await archiveInstitutional(req.params.id,req.user!.id))));
  r.post('/institutional/:id/restore-archive',CRIA,ah(async(req,res)=>res.json(await restoreArchivedInstitutional(req.params.id,req.user!.id))));
  r.post('/institutional/:id/sync-references',CRIA,ah(async(req,res)=>res.json(await syncInstitutionalReferences(req.params.id,req.body,req.user!.id))));
  r.patch('/institutional/:id/design/:format',CRIA,ah(async(req,res)=>res.json(await updateInstitutionalDesign(req.params.id,InstitutionFormat.parse(req.params.format),req.body,req.user!.id))));
  r.patch('/institutional/:id/distribution',CRIA,ah(async(req,res)=>res.json(await updateInstitutionalDistribution(req.params.id,req.body,req.user!.id))));
  r.post('/institutional/:id/background/:format',CRIA,upload.single('file'),ah(async(req,res)=>res.json(await uploadInstitutionalBackground(req.params.id,InstitutionFormat.parse(req.params.format),req.body,req.file,req.user!.id))));
  r.get('/institutional/:id', ah(async (req, res) => {
    res.json(await getInstitutional(req.params.id));
  }));
  r.get('/institutional/:id/audit', ah(async (req, res) => {
    res.json(await getInstitutionalAudit(req.params.id));
  }));
  r.post('/institutional/:id/generate', CRIA, ah(async (req, res) => {
    const input = z.object({baseRevision:z.number().int().positive().optional()}).parse(req.body ?? {});
    res.json(await regenerateInstitutional(req.params.id, req.user!.id, input.baseRevision));
  }));
  r.post('/institutional/:id/ai-edit', CRIA, ah(async (req, res) => {
    res.json(await proposeInstitutionalEdit(req.params.id, req.body, req.user!.id));
  }));
  r.patch('/institutional/:id/copy', CRIA, ah(async (req, res) => {
    res.json(await updateInstitutionalCopy(req.params.id, req.body, req.user!.id));
  }));
  r.post('/institutional/:id/review', REVISA, ah(async (req, res) => {
    const input = z.object({decision: z.enum(['aprovada','reprovada']),note:z.string().max(500).default(''),baseRevision:z.number().int().positive().optional()}).parse(req.body);
    res.json(await reviewInstitutional(req.params.id, input.decision, req.user!.id, input.note, input.baseRevision));
  }));
  r.post('/institutional/:id/art/:format', CRIA, ah(async (req, res) => {
    // Demo auth lets anyone choose a user; protect image quota with a second secret.
    if (isDemo() && !verifyGenerationSecret(String(req.headers['x-image-generation-secret'] ?? ''))) {
      throw new HttpError(403, 'Senha de geração de imagem incorreta. Configure IMAGE_GENERATION_SECRET no .env e informe a mesma senha na tela.');
    }
    const format = InstitutionFormat.parse(req.params.format);
    res.json(await generateInstitutionalArtwork(req.params.id, format, req.user!.id));
  }));
  r.get('/institutional/:id/preview/:format', ah(async (req, res) => {
    const format = InstitutionFormat.parse(req.params.format);
    const c = await getInstitutional(req.params.id);
    if (!c.input.formats.includes(format)) return res.status(400).json({error:'Formato não selecionado nesta campanha.'});
    res.json({ svg: await renderInstitutionalSvg(c, format), status:c.status });
  }));
  r.get('/institutional/:id/export', ah(async (req, res) => {
    const c = await getInstitutional(req.params.id);
    const buffer = await institutionalZip(c, req.user!.id);
    res.setHeader('content-type','application/zip');
    res.setHeader('content-disposition',`attachment; filename="${c.id}-aprovado.zip"`);
    res.send(buffer);
  }));

  // O módulo antigo só pode ser acessado no modo explícito de demonstração.
  r.use((_req,res,next)=>{if(!isDemo())return res.status(404).json({error:'Este recurso pertence à demonstração antiga.'});next();});

  // catálogo e ofertas (fonte comercial)
  r.get('/catalog', ah(Catalog.catalog));
  r.get('/offers', ah(Catalog.offers));
  r.get('/offers/template.csv', ah(Catalog.offersTemplate));
  r.post('/offers/import', ADMIN, upload.single('file'), ah(Catalog.importOffers));

  // campanhas
  r.get('/campaigns', ah(Campaign.list));
  r.post('/campaigns/preview', ah(Campaign.preview));
  r.post('/campaigns', CRIA, ah(Campaign.create));
  r.get('/campaigns/:id', ah(Campaign.detail));
  r.post('/campaigns/:id/concept/generate', CRIA, ah(Campaign.generateConcept));
  r.put('/campaigns/:id/concept', CRIA, ah(Campaign.editConcept));
  r.get('/campaigns/:id/messages', ah(Campaign.messages));
  r.post('/campaigns/:id/generate', CRIA, ah(Campaign.generatePieces));
  r.post('/campaigns/:id/revalidate', ah(Campaign.revalidate));
  r.get('/campaigns/:id/audit', ah(Campaign.audit));
  r.get('/campaigns/:id/metrics', ah(Campaign.metrics));
  r.post('/campaigns/:id/export', ah(Campaign.export));
  r.get('/exports/:exportId/download', ah(Campaign.download));

  // peças (estúdio)
  r.get('/creatives/:id', ah(Creative.detail));
  r.get('/versions/:versionId', ah(Creative.version));
  r.patch('/creatives/:id/layers', CRIA, ah(Creative.manualEdit));
  r.post('/creatives/:id/ai-edits', CRIA, ah(Creative.proposeAi));
  r.post('/ai-edits/:proposalId/apply', CRIA, ah(Creative.applyAi));
  r.post('/ai-edits/:proposalId/discard', CRIA, ah(Creative.discardAi));
  r.post('/creatives/:id/restore', CRIA, ah(Creative.restore));
  r.post('/creatives/:id/validate', ah(Creative.validate));
  r.post('/creatives/:id/critique', ah(Creative.critique));
  r.get('/creatives/:id/png', ah(Creative.png));

  // revisão e aprovação
  r.get('/reviews/queue', ah(Review.queue));
  r.post('/concepts/:id/review', REVISA, ah(Review.concept));
  r.post('/creatives/:id/review', REVISA, ah(Review.creative));
  r.post('/reviews/batch-approve', REVISA, ah(Review.batch));
  r.get('/campaigns/:id/semantic', ah(Review.semanticConcept));
  r.get('/creatives/:id/semantic', ah(Review.semanticCreative));
  r.post('/semantic/:hash/dismiss', REVISA, ah(Review.dismissSemantic));

  // administração
  r.get('/admin/rules', ah(Admin.rules));
  r.put('/admin/rules', ADMIN, ah(Admin.updateRules));
  r.get('/admin/settings', ah(Admin.settings));
  r.put('/admin/settings', ADMIN, ah(Admin.updateSettings));
  r.get('/learnings', ah(Admin.learnings));
  r.post('/learnings', ADMIN, ah(Admin.addLearning));
  r.post('/learnings/:id/decision', ADMIN, ah(Admin.decideLearning));
  r.post('/admin/reset-demo', ADMIN, ah(Admin.resetDemo));

  return r;
}
