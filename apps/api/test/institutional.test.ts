import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { initDb } from '../src/db/client';
import { seedDatabase } from '../src/db/seed';

const app = createApp();
let creator='';
let reviewer='';
let admin='';
let id='';
const payload = {
  brandId:'lumos-connect', name:'Conheça o Norya',
  objective:'Apresentar a plataforma e seus diferenciais de acessibilidade.',
  audience:'Estudantes e professores',
  keyMessage:'O Norya é a plataforma educacional inclusiva criada pela Lumos Connect.',
  cta:'Conheça nosso projeto',
  sourceNotes:'Briefing institucional verificado e autorizado para o piloto.',
  formats:['feed','story','banner'], confirmed:true,
};
const auth = (token:string) => `Bearer ${token}`;
beforeAll(async () => {
  await initDb({ memory:true });
  await seedDatabase();
  creator=(await request(app).post('/api/auth/login').send({userId:'u-ana'})).body.token;
  reviewer=(await request(app).post('/api/auth/login').send({userId:'u-rui'})).body.token;
  admin=(await request(app).post('/api/auth/login').send({userId:'u-bia'})).body.token;
});

describe('campanha real da Lumos em fluxo separado', () => {
  it('rejeita briefing sem confirmação e acesso sem autenticação', async () => {
    expect((await request(app).post('/api/institutional').send(payload)).status).toBe(401);
    expect((await request(app).post('/api/institutional').set('authorization',auth(creator)).send({...payload,confirmed:false})).status).toBe(400);
  });
  it('cria briefing real e prévia personalizada, sem preços farmacêuticos', async () => {
    const r=await request(app).post('/api/institutional').set('authorization',auth(creator)).send(payload);
    expect(r.status).toBe(201);
    id=r.body.id;
    expect(r.body.brand.name).toBe('Lumos Connect');
    expect(r.body.aiMode).toMatch(/template|ia-/);
    const preview=await request(app).get(`/api/institutional/${id}/preview/feed`).set('authorization',auth(creator));
    expect(preview.status).toBe(200);
    expect(preview.body.svg).toContain('Lumos Connect');
    expect(preview.body.svg).not.toContain('R$');
  });
  it('bloqueia exportação não aprovada e revisão pelo criador', async () => {
    expect((await request(app).get(`/api/institutional/${id}/export`).set('authorization',auth(creator))).status).toBe(409);
    expect((await request(app).post(`/api/institutional/${id}/review`).set('authorization',auth(creator)).send({decision:'aprovada'})).status).toBe(403);
    // Admin has reviewer permission but cannot approve a piece they created.
  });
  it('aprova com revisor diferente; edição revoga aprovação', async () => {
    const approved=await request(app).post(`/api/institutional/${id}/review`).set('authorization',auth(reviewer)).send({decision:'aprovada',note:'Verificado'});
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('aprovada');
    const changed=await request(app).patch(`/api/institutional/${id}/copy`).set('authorization',auth(creator)).send({headline:'Conheça o Norya — nova versão'});
    expect(changed.status).toBe(200);
    expect(changed.body.status).toBe('rascunho');
    expect(changed.body.reviewedBy).toBeNull();
    expect((await request(app).get(`/api/institutional/${id}/export`).set('authorization',auth(admin))).status).toBe(409);
  });
  it('impede aprovação por papel sem permissão', async () => {
    // Creator role is intentionally not allowed to review, regardless of campaign.
    const r=await request(app).post(`/api/institutional/${id}/review`).set('authorization',auth(creator)).send({decision:'aprovada'});
    expect(r.status).toBe(403);
  });
});
