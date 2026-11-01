import request from 'supertest';
import ExcelJS from 'exceljs';
import { closeRenderer } from '../src/services/render.service';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { initDb } from '../src/db/client';
import { seedDatabase } from '../src/db/seed';
const app=createApp();let admin='',creator='',reviewer='';
const as=(token=admin)=>({authorization:`Bearer ${token}`});
const endpoint='/api/brands/lumos-connect/catalog';
const item={id:'servico-teste',kind:'servico',name:'Serviço de exemplo',description:'Serviço fictício usado apenas nos testes automatizados.',priceCents:1990,conditions:'Condição cadastrada pelo responsável.',sourceNotes:'Fixture de teste; sem oferta real.',active:true};
beforeAll(async()=>{await initDb({memory:true});await seedDatabase();for(const id of ['u-bia','u-ana','u-rui']){const token=(await request(app).post('/api/auth/login').send({userId:id})).body.token;if(id==='u-bia')admin=token;else if(id==='u-ana')creator=token;else reviewer=token;}});
afterAll(async()=>{await closeRenderer();});
describe('catálogo de marcas com dados próprios',()=>{
 it('protege o cadastro e mantém os itens associados à marca',async()=>{
  expect((await request(app).get(endpoint)).status).toBe(401);
  expect((await request(app).put(endpoint).set(as(creator)).send(item)).status).toBe(403);
  expect((await request(app).put(endpoint).set(as()).send(item)).status).toBe(200);
  expect((await request(app).get(endpoint).set(as())).body[0].priceCents).toBe(1990);
  expect((await request(app).get('/api/brands/marca-inexistente/catalog').set(as())).status).toBe(404);
 });
 it('conferencia CSV não grava; confirmação salva os itens válidos com erros por linha',async()=>{
  const csv='id;tipo;nome;descricao;preco;condicoes;fonte;ativo\nimportado;serviço;Atendimento;Atendimento de exemplo;29,90;Por sessão;Dados do responsável;true\nerro;produto;Incompleto;;;x;Fonte de teste;true\n';
  const preview=await request(app).post(endpoint+'/import?dryRun=1').set(as()).attach('file',Buffer.from(csv),'catalogo.csv');
  expect(preview.status).toBe(200);expect(preview.body.valid).toBe(1);expect(preview.body.saved).toBe(false);expect(preview.body.errors[0].line).toBe(3);
  expect((await request(app).get(endpoint).set(as())).body).toHaveLength(1);
  const saved=await request(app).post(endpoint+'/import?dryRun=0').set(as()).attach('file',Buffer.from(csv),'catalogo.csv');
  expect(saved.body.saved).toBe(true);expect(saved.body.items[0].priceCents).toBe(2990);
 });
 it('importa XLSX e mantém serviço sem preço',async()=>{
  const wb=new ExcelJS.Workbook();const sheet=wb.addWorksheet('Catálogo');
  sheet.addRow(['id','tipo','nome','descricao','preco','condicoes','fonte','ativo']);sheet.addRow(['sem-preco','servico','Norya de teste','Descrição de teste sem preço.',null,'','Informação de teste',true]);
  const res=await request(app).post(endpoint+'/import?dryRun=0').set(as()).attach('file',Buffer.from(await wb.xlsx.writeBuffer()),'catalogo.xlsx');
  expect(res.status).toBe(200);expect(res.body.items[0].priceCents).toBeNull();expect(res.body.saved).toBe(true);
 });
 it('preserva preço e condições na arte e bloqueia preços digitados em texto livre',async()=>{
  const input={brandId:'lumos-connect',catalogItemId:item.id,name:'Campanha com item',objective:'Apresentar um serviço cadastrado para teste.',audience:'Comunidade de teste',keyMessage:'Conheça os serviços cadastrados pela empresa.',cta:'Saiba mais',sourceNotes:'Dados fictícios de teste automatizado.',formats:['feed'],confirmed:true};
  const created=await request(app).post('/api/institutional').set(as(creator)).send(input);
  expect(created.status).toBe(201);expect(created.body.catalogItem.priceCents).toBe(1990);
  const id=created.body.id;
  const preview=await request(app).get(`/api/institutional/${id}/preview/feed`).set(as(creator));
  expect(preview.body.svg).toContain('19,90');expect(Array.from(preview.body.svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g),m=>(m as RegExpMatchArray)[1]).join(' ')).toContain(item.conditions);
  expect((await request(app).patch(`/api/institutional/${id}/copy`).set(as(creator)).send({headline:'Apenas R$ 1,00'})).status).toBe(400);
  await request(app).post(`/api/institutional/${id}/review`).set(as(reviewer)).send({decision:'aprovada'});
  const exported=await request(app).get(`/api/institutional/${id}/export`).set(as(creator));
  expect(exported.status).toBe(200);
  await request(app).put(endpoint).set(as()).send({...item,priceCents:2090});
  const blocked=await request(app).get(`/api/institutional/${id}/export`).set(as(creator));
  expect(blocked.status).toBe(409);expect(blocked.body.error).toContain('alterado no catálogo');
 });
});
