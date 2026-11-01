import request from 'supertest';
import JSZip from 'jszip';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { initDb } from '../src/db/client';
import { seedDatabase } from '../src/db/seed';
import { env } from '../src/config/env';
import { closeRenderer } from '../src/services/render.service';

const app=createApp();
const tokens:Record<string,string>={};
const auth=(who='ana')=>({authorization:`Bearer ${tokens[who]}`});
const input={brandId:'lumos-connect',name:'Norya com a Lumos',objective:'Apresentar a plataforma educacional à comunidade.',audience:'Estudantes e professores',keyMessage:'Norya é uma plataforma educacional da Lumos Connect.',cta:'Conheça o projeto e converse com a nossa equipe',sourceNotes:'Informações conferidas e autorizadas pela equipe.',formats:['feed','story','banner'],confirmed:true};
const original={provider:env.aiProvider,accountId:env.cloudflare.accountId,token:env.cloudflare.token};
let id='';
beforeAll(async()=>{
 await initDb({memory:true});await seedDatabase();
 for(const [name,userId] of [['ana','u-ana'],['rui','u-rui'],['bia','u-bia']]) tokens[name]=(await request(app).post('/api/auth/login').send({userId})).body.token;
 id=(await request(app).post('/api/institutional').set(auth()).send(input)).body.id;
});
afterAll(async()=>{env.aiProvider=original.provider;env.cloudflare.accountId=original.accountId;env.cloudflare.token=original.token;vi.unstubAllGlobals();await closeRenderer();});

describe('qualidade e revisão institucional',()=>{
 it('bloqueia edição e aprovação de uma aba desatualizada',async()=>{
  const first=(await request(app).get(`/api/institutional/${id}`).set(auth())).body;
  const edited=await request(app).patch(`/api/institutional/${id}/copy`).set(auth()).send({headline:'Conheça o Norya',baseRevision:first.revision});
  expect(edited.status).toBe(200);expect(edited.body.revision).toBe(first.revision+1);
  expect((await request(app).patch(`/api/institutional/${id}/copy`).set(auth()).send({headline:'Texto antigo',baseRevision:first.revision})).status).toBe(409);
  expect((await request(app).post(`/api/institutional/${id}/review`).set(auth('rui')).send({decision:'aprovada',baseRevision:first.revision})).status).toBe(409);
 });
 it('administrador que edita não pode aprovar a própria edição',async()=>{
  const edited=await request(app).patch(`/api/institutional/${id}/copy`).set(auth('bia')).send({subtitle:'Aprendizagem inclusiva com a Lumos Connect.'});
  expect(edited.status).toBe(200);expect(edited.body.lastEditedBy).toBe('u-bia');
  expect((await request(app).post(`/api/institutional/${id}/review`).set(auth('bia')).send({decision:'aprovada'})).status).toBe(403);
  expect((await request(app).post(`/api/institutional/${id}/review`).set(auth('rui')).send({decision:'aprovada'})).status).toBe(200);
 });
 it('exporta três PNGs de dimensões corretas com CTA completo e versão aprovada',async()=>{
  const res=await request(app).get(`/api/institutional/${id}/export`).set(auth()).buffer(true).parse((res,done)=>{const chunks:Buffer[]=[];res.on('data',(chunk:Buffer)=>chunks.push(chunk));res.on('end',()=>done(null,Buffer.concat(chunks)));res.on('error',done);});
  expect(res.status).toBe(200);
  const zip=await JSZip.loadAsync(res.body);
  for(const [format,width,height] of [['feed',1080,1080],['story',1080,1920],['banner',1920,1080]] as const){
   const png=await zip.file(`lumos-connect-${format}.png`)!.async('nodebuffer');
   expect(png.subarray(1,4).toString()).toBe('PNG');expect(png.readUInt32BE(16)).toBe(width);expect(png.readUInt32BE(20)).toBe(height);
   const preview=await request(app).get(`/api/institutional/${id}/preview/${format}`).set(auth());
   expect(preview.body.svg).not.toContain('…');
   expect(preview.body.svg).toContain('@font-face');
   const texts=Array.from(preview.body.svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g),m=>(m as RegExpMatchArray)[1]).join(' ');
   expect(texts).toContain(input.cta);
  }
  const manifest=JSON.parse(await zip.file('manifest.json')!.async('string'));
  expect(manifest.approvedBy).toBe('u-rui');expect(manifest.revision).toBeGreaterThan(1);expect(manifest.approvedCopy.cta).toBe(input.cta);
  expect(manifest.artworkProvenance.feed.source).toContain('sem imagem IA');
 },60000);
 it('não simula IA na edição por comando e barra pedidos comerciais antes da chamada',async()=>{
  const campaign=(await request(app).get(`/api/institutional/${id}`).set(auth())).body;
  expect((await request(app).post(`/api/institutional/${id}/ai-edit`).set(auth()).send({instruction:'Encurte o título',baseRevision:campaign.revision})).status).toBe(503);
  expect((await request(app).post(`/api/institutional/${id}/ai-edit`).set(auth()).send({instruction:'Mude o preço para R$ 1,00',baseRevision:campaign.revision})).status).toBe(400);
 });
 it('proposta por IA preserva o CTA, não altera a campanha e só é aplicada após confirmação',async()=>{
  const campaign=(await request(app).get(`/api/institutional/${id}`).set(auth())).body;
  env.aiProvider='cloudflare';env.cloudflare.accountId='test-account';env.cloudflare.token='test-token';
  const next={...campaign.copies,headline:'Norya: conheça a plataforma'};
  const fetch=vi.fn(async(url:string,opts:RequestInit)=>{
   expect(url).toContain('api.cloudflare.com');expect(url).toContain('/ai/v1/chat/completions');
   const body=JSON.parse(String(opts.body));expect(body.response_format.type).toBe('json_object');expect(typeof body.messages[1].content).toBe('string');
   return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(next)}}]}));
  });
  vi.stubGlobal('fetch',fetch);
  const proposed=await request(app).post(`/api/institutional/${id}/ai-edit`).set(auth()).send({instruction:'Encurte o título com clareza',baseRevision:campaign.revision});
  expect(proposed.status).toBe(200);expect(fetch).toHaveBeenCalledTimes(1);
  const beforeApply=(await request(app).get(`/api/institutional/${id}`).set(auth())).body;
  expect(beforeApply.status).toBe('aprovada');expect(beforeApply.copies.headline).toBe(campaign.copies.headline);
  const applied=await request(app).patch(`/api/institutional/${id}/copy`).set(auth()).send({...proposed.body.copy,baseRevision:proposed.body.baseRevision});
  expect(applied.status).toBe(200);expect(applied.body.status).toBe('rascunho');expect(applied.body.copies.headline).toBe(next.headline);
  env.aiProvider='mock';vi.unstubAllGlobals();
 });
 it('rejeita respostas da IA com números inventados',async()=>{
  const campaign=(await request(app).get(`/api/institutional/${id}`).set(auth())).body;
  env.aiProvider='cloudflare';
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({...campaign.copies,headline:'Aprenda 987654 vezes mais'})}}]}))));
  const res=await request(app).post(`/api/institutional/${id}/ai-edit`).set(auth()).send({instruction:'Deixe o título mais acolhedor',baseRevision:campaign.revision});
  expect(res.status).toBe(422);env.aiProvider='mock';vi.unstubAllGlobals();
 });
});
