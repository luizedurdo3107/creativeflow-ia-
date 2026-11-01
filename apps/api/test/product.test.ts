import request from 'supertest';
import { afterAll,beforeAll,describe,it,expect,vi } from 'vitest';
import { resolve } from 'node:path';
import { createApp } from '../src/app';
import { initDb,db,createDb } from '../src/db/client';
import { seedIfEmpty } from '../src/db/seed';
import { env } from '../src/config/env';
import { generateInstitutionalCopy } from '../src/services/ai/llm';
import { reserveAICall } from '../src/services/usage.service';
import { backupWorkspace,restoreWorkspace } from '../src/services/backup.service';
import { closeRenderer } from '../src/services/render.service';
const app=createApp();
const original={mode:env.appMode,provider:env.aiProvider,images:env.imageDailyLimit,text:env.textDailyLimit,account:env.cloudflare.accountId,token:env.cloudflare.token,secret:env.image.generationSecret};
const ownerPass='frase de acesso apenas para teste 2026';const memberPass='outra frase longa apenas de teste 2026';
let owner='',reviewer='',ownerId='',reviewerId='',id='',revision=1;
const cookie=(r:request.Response)=>String(r.headers['set-cookie']?.[0]??'').split(';')[0];
const api=(method:'get'|'post'|'put'|'patch',url:string,session=owner)=>request(app)[method]('/api'+url).set('x-cf-client','creativeflow-web').set('cookie',session);
const input={brandId:'empresa-real',name:'Campanha da empresa',objective:'Apresentar o serviço com dados cadastrados pela empresa.',audience:'Comunidade local',keyMessage:'A empresa apresenta seus serviços à comunidade.',cta:'Conheça o serviço',sourceNotes:'Dados de fixture aprovados apenas para teste.',formats:['feed'],channels:['instagram'],confirmed:true,copyMode:'briefing'};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAA00lEQVR4nAHIADf/AaZVkrk81yPrKvMezyfX+9UTHAHZOQcaoATyStf6yvUTIe4rv/rY+QApPA0W/tb09EcE+MU4KwkSAA/6sBEAC/fgG+LX5igtuuD0Agz78Qkj3Ort6Arm7vPyKuD6ARAAGSHW/wLYKvHoHtYMAuEQVkL6Bt/3HlLfsujnKwQEFRvP3dlR/tK37d3WHzL08vjcMPz7HhbYAsjdTT3u/uI/OzsY6fbmMw+4xwwbHce3BgQkEuwND9Yk+RD8LjxEzPYBUEDB++0uEyTHWGS8VMarNQAAAABJRU5ErkJggg==','base64');
beforeAll(async()=>{env.appMode='product';await initDb({memory:true});await seedIfEmpty();});
afterAll(async()=>{await closeRenderer();await db().close();env.appMode=original.mode;env.aiProvider=original.provider;env.imageDailyLimit=original.images;env.textDailyLimit=original.text;env.cloudflare.accountId=original.account;env.cloudflare.token=original.token;env.image.generationSecret=original.secret;vi.unstubAllGlobals();});
describe('produto sem dados de demonstração',()=>{
 it('começa vazio, não lista usuários publicamente e recusa solicitações de outra origem',async()=>{
  expect((await api('get','/auth/config','')).body.setupRequired).toBe(true);
  expect((await db().query('select id from users')).rows).toHaveLength(0);
  expect((await api('get','/auth/users','')).status).toBe(404);
  expect((await request(app).post('/api/auth/setup').send({})).status).toBe(403);
  expect((await api('post','/auth/setup','').set('origin','https://origem-invalida.test').send({})).status).toBe(403);
 });
 it('cadastra um único proprietário com senha protegida e cookie HttpOnly',async()=>{
  const r=await api('post','/auth/setup','').send({name:'Responsável de teste',email:'owner@example.test',password:ownerPass});
  expect(r.status).toBe(201);owner=cookie(r);ownerId=r.body.user.id;
  expect(r.headers['set-cookie'][0]).toContain('HttpOnly');expect(r.headers['set-cookie'][0]).toContain('SameSite=Strict');expect(r.body.token).toBeUndefined();
  const hash=(await db().query<{password_hash:string}>('select password_hash from users where id=$1',[ownerId])).rows[0].password_hash;
  expect(hash).toContain('scrypt-v1$');expect(hash).not.toContain(ownerPass);
  expect((await api('post','/auth/setup','').send({name:'Segundo',email:'outro@example.test',password:ownerPass})).status).toBe(409);
  expect((await api('get','/system/brand-profiles')).body).toEqual([]);
  expect((await api('get','/institutional')).body).toEqual([]);
 });
 it('exige senha e sessão real, bloqueia o login por seleção e o módulo antigo',async()=>{
  expect((await api('post','/auth/login','').send({userId:ownerId})).status).toBe(400);
  expect((await api('post','/auth/login','').send({email:'owner@example.test',password:'incorreta'})).status).toBe(401);
  expect((await request(app).get('/api/me').set('authorization','Bearer token-do-mvp')).status).toBe(401);
  expect((await api('get','/me')).body.id).toBe(ownerId);
  expect((await api('get','/catalog')).status).toBe(404);
  expect((await api('post','/admin/reset-demo').send({})).status).toBe(404);
 });
 it('usa convite individual de uso único e mantém o papel definido pelo administrador',async()=>{
  const r=await api('post','/team/invitations').send({name:'Revisora de teste',email:'reviewer@example.test',role:'revisor'});
  expect(r.status).toBe(201);const token=new URLSearchParams(new URL(r.body.url).hash.slice(1)).get('convite');
  const accepted=await api('post','/auth/accept','').send({token,password:memberPass,role:'admin'});
  expect(accepted.status).toBe(200);reviewer=cookie(accepted);reviewerId=accepted.body.user.id;expect(accepted.body.user.role).toBe('revisor');
  expect((await api('post','/auth/accept','').send({token,password:memberPass})).status).toBe(400);
  expect((await api('get','/team',reviewer)).status).toBe(403);
  expect((await api('patch','/team/'+ownerId).send({role:'criador',active:false})).status).toBe(400);
 });
 it('cria com dados fornecidos, sem geração fictícia e sem cobrança externa',async()=>{
  const brand={id:'empresa-real',name:'Empresa cadastrada',description:'Descrição fornecida pela própria organização.',colors:['#123456','#abcdef'],tone:'Claro e acolhedor',fontFamily:'Inter',guidelines:'Somente fatos autorizados.'};
  expect((await api('put','/system/brand-profiles').send(brand)).status).toBe(200);
  expect((await api('post','/institutional').send({...input,copyMode:'ai'})).status).toBe(503);
  const r=await api('post','/institutional').send(input);expect(r.status).toBe(201);id=r.body.id;revision=r.body.revision;
  expect(r.body.aiMode).toBe('briefing-sem-ia');expect(r.body.copies.subtitle).toBe(input.keyMessage);
  expect((await api('post',`/institutional/${id}/review`,reviewer).send({decision:'aprovada',baseRevision:revision})).status).toBe(409);
 });
 it('gera imagem com sessão de criação, sem senha técnica extra, e aplica o limite diário',async()=>{
  env.cloudflare.accountId='conta-de-teste';env.cloudflare.token='token-simulado';env.image.generationSecret='';env.imageDailyLimit=1;
  const fetch=vi.fn(async()=>new Response(JSON.stringify({success:true,result:{image:png.toString('base64')}})));
  vi.stubGlobal('fetch',fetch);
  expect((await api('post',`/institutional/${id}/art/feed`,reviewer)).status).toBe(403);
  const r=await api('post',`/institutional/${id}/art/feed`).send({});expect(r.status).toBe(200);revision=r.body.revision;
  expect((await api('post',`/institutional/${id}/art/feed`).send({})).status).toBe(429);expect(fetch).toHaveBeenCalledTimes(1);
  vi.unstubAllGlobals();
 });
 it('limita atomicamente chamadas simultâneas antes de acessar a IA',async()=>{
  env.textDailyLimit=2;const results=await Promise.allSettled(Array.from({length:6},()=>reserveAICall('text')));
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(2);expect(results.filter(r=>r.status==='rejected')).toHaveLength(4);
 });
 it('envia para revisão e exige decisão independente na versão atual',async()=>{
  const sent=await api('post',`/institutional/${id}/submit`).send({baseRevision:revision});expect(sent.status).toBe(200);revision=sent.body.revision;
  expect((await api('post',`/institutional/${id}/review`).send({decision:'aprovada',baseRevision:revision})).status).toBe(403);
  const r=await api('post',`/institutional/${id}/review`,reviewer).send({decision:'aprovada',baseRevision:revision});expect(r.status).toBe(200);revision=r.body.revision;
  expect((await api('get',`/institutional/${id}/export`)).status).toBe(200);
 });
 it('arquiva sem apagar e restaura como rascunho, exigindo nova revisão',async()=>{
  expect((await api('post',`/institutional/${id}/archive`).send({})).status).toBe(200);
  expect((await api('get','/institutional')).body).toEqual([]);
  expect((await api('get','/institutional/archived')).body).toHaveLength(1);
  const r=await api('post',`/institutional/${id}/restore-archive`).send({});expect(r.status).toBe(200);expect(r.body.status).toBe('rascunho');revision=r.body.revision;
  expect((await api('get',`/institutional/${id}/export`)).status).toBe(409);
 });
 it('mantém o backup privado e restaura os dados em outro banco, sem sessões antigas',async()=>{
  expect((await api('get','/workspace/backup',reviewer)).status).toBe(403);
  const backup=await backupWorkspace();const target=resolve(env.dataDir,'restauracao-teste');
  const restored=await restoreWorkspace(backup,target);expect(restored.campaigns).toBe(1);
  const restoredDb=await createDb({dataDir:target,databaseUrl:''});
  try{expect((await restoredDb.query('select id from users')).rows).toHaveLength(2);expect((await restoredDb.query('select id from institutional_campaigns')).rows).toHaveLength(1);expect((await restoredDb.query('select token_hash from auth_sessions')).rows).toHaveLength(0);expect((await restoredDb.query('select sku from products')).rows).toHaveLength(0);}finally{await restoredDb.close();}
  await expect(restoreWorkspace(backup,target)).rejects.toThrow('vazia');
 });
 it('edita briefing e identidade sem reaproveitar aprovação ou fundo antigo',async()=>{
  const r=await api('patch',`/institutional/${id}/briefing`).send({input:{...input,name:'Briefing atualizado pela equipe'},baseRevision:revision});
  expect(r.status).toBe(200);expect(r.body.name).toBe('Briefing atualizado pela equipe');expect(r.body.artworks).toEqual({});expect(r.body.status).toBe('rascunho');revision=r.body.revision;
  expect((await api('patch',`/institutional/${id}/briefing`).send({input,baseRevision:1})).status).toBe(409);
 });
 it('recupera acesso por link único, expira convites e revoga usuários desativados',async()=>{
  const expired=await api('post','/team/invitations').send({name:'Pendente',email:'pending@example.test',role:'criador'});
  const expiredToken=new URLSearchParams(new URL(expired.body.url).hash.slice(1)).get('convite');
  await db().query("update team_invitations set expires_at=now()-interval '1 second' where email='pending@example.test'");
  expect((await api('post','/auth/accept','').send({token:expiredToken,password:memberPass})).status).toBe(400);
  const recovery=await api('post','/team/invitations').send({name:'Revisora',email:'reviewer@example.test',role:'admin',reset:true});
  const token=new URLSearchParams(new URL(recovery.body.url).hash.slice(1)).get('convite');
  const r=await api('post','/auth/accept','').send({token,password:memberPass});expect(r.status).toBe(200);expect(r.body.user.role).toBe('revisor');
  expect((await api('get','/me',reviewer)).status).toBe(401);reviewer=cookie(r);
  expect((await api('patch','/team/'+reviewerId).send({role:'revisor',active:false})).status).toBe(200);
  expect((await api('get','/me',reviewer)).status).toBe(401);
  await api('patch','/team/'+reviewerId).send({role:'admin',active:true});
  const adminLogin=await api('post','/auth/login','').send({email:'reviewer@example.test',password:memberPass});
  expect((await api('patch','/team/'+ownerId,cookie(adminLogin)).send({role:'criador',active:false})).status).toBe(400);
  await api('patch','/team/'+reviewerId).send({role:'revisor',active:true});
 });
 it('chama somente o modelo gratuito de texto e não envia arquivos de logo ao modelo',async()=>{
  env.aiProvider='cloudflare';env.textDailyLimit=20;
  const brand={id:'empresa-real',name:'Empresa cadastrada',description:'Dados oficiais fornecidos pela empresa.',colors:['#123456'],tone:'Claro e acolhedor',guidelines:'Somente fatos autorizados.',logoDataUri:'data:image/png;base64,'+'A'.repeat(500000)};
  expect((await api('put','/system/brand-profiles').send(brand)).status).toBe(200);
  const fetch=vi.fn(async(url:string,opts:RequestInit)=>{
   expect(url).toContain('api.cloudflare.com');const body=JSON.parse(String(opts.body));expect(body.max_tokens).toBeLessThanOrEqual(800);expect(JSON.stringify(body)).not.toContain('data:image/png');
   return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({headline:'Apresentação da empresa',subtitle:input.keyMessage,caption:'Informações fornecidas e conferidas pela equipe.',cta:input.cta})}}]}));
  });
  vi.stubGlobal('fetch',fetch);
  const r=await api('post','/institutional').send({...input,copyMode:'ai'});expect(r.status).toBe(201);expect(r.body.aiMode).toBe('ia-cloudflare');expect(fetch).toHaveBeenCalledTimes(1);
  env.aiProvider='openai';await expect(generateInstitutionalCopy(input,brand)).rejects.toMatchObject({status:403});expect(fetch).toHaveBeenCalledTimes(1);
  env.aiProvider='mock';vi.unstubAllGlobals();
 });
 it('explica falhas de credencial, cota e indisponibilidade sem criar campanhas nem repetir a chamada',async()=>{
  const count=(await db().query('select id from institutional_campaigns')).rows.length;
  env.aiProvider='cloudflare';env.textDailyLimit=20;
  const failures=[
   {http:401,status:502,message:'recusou a credencial'},
   {http:403,status:502,message:'recusou a credencial'},
   {http:402,status:429,message:'cota ou o limite'},
   {http:429,status:429,message:'cota ou o limite'},
   {http:503,status:503,message:'temporariamente indisponível'},
   {http:404,status:502,message:'modelo de texto'},
  ];
  try {
   for(const f of failures){
    const fetch=vi.fn(async()=>new Response(JSON.stringify({errors:[{message:'conteúdo privado do provedor'}]}),{status:f.http}));
    vi.stubGlobal('fetch',fetch);
    const r=await api('post','/institutional').send({...input,copyMode:'ai'});
    expect(r.status).toBe(f.status);expect(r.body.error).toContain(f.message);
    expect(JSON.stringify(r.body)).not.toContain('conteúdo privado');
    expect(fetch).toHaveBeenCalledTimes(1);
   }
   expect((await db().query('select id from institutional_campaigns')).rows).toHaveLength(count);
  } finally {env.aiProvider='mock';vi.unstubAllGlobals();}
 });
 it('altera a senha, revoga as sessões anteriores e permite sair de forma efetiva',async()=>{
  const second=await api('post','/auth/login','').send({email:'owner@example.test',password:ownerPass});expect(second.status).toBe(200);const secondCookie=cookie(second);
  const changed=await api('post','/account/password').send({currentPassword:ownerPass,newPassword:'nova frase de senha apenas para teste 2026'});expect(changed.status).toBe(200);owner=cookie(changed);
  expect((await api('get','/me',secondCookie)).status).toBe(401);
  expect((await api('get','/me')).status).toBe(200);
  expect((await api('post','/auth/logout').send({})).status).toBe(200);
  expect((await api('get','/me')).status).toBe(401);
 });
});
