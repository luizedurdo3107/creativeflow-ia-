import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { initDb } from '../src/db/client';
import { seedDatabase } from '../src/db/seed';
import { env } from '../src/config/env';
import { buildBrandArtworkPrompt, imageAIStatus, verifyGeneratedPng } from '../src/services/image-ai.service';

const app = createApp();
const auth = (token:string) => `Bearer ${token}`;
let creator = '';
let reviewer = '';
let id = '';
const originalToken = env.cloudflare.token;
const originalAccountId = env.cloudflare.accountId;
const originalEnabled = env.image.enabled;
const originalSecret = env.image.generationSecret;
const originalFetch = globalThis.fetch;

// Authentic 8x8 PNG fixture. Only the HTTP response is mocked; no paid API call.
const fakePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAA00lEQVR4nAHIADf/AaZVkrk81yPrKvMezyfX+9UTHAHZOQcaoATyStf6yvUTIe4rv/rY+QApPA0W/tb09EcE+MU4KwkSAA/6sBEAC/fgG+LX5igtuuD0Agz78Qkj3Ort6Arm7vPyKuD6ARAAGSHW/wLYKvHoHtYMAuEQVkL6Bt/3HlLfsujnKwQEFRvP3dlR/tK37d3WHzL08vjcMPz7HhbYAsjdTT3u/uI/OzsY6fbmMw+4xwwbHce3BgQkEuwND9Yk+RD8LjxEzPYBUEDB++0uEyTHWGS8VMarNQAAAABJRU5ErkJggg==','base64');
const input = {
  brandId:'lumos-connect', name:'Divulgação do Norya',
  objective:'Divulgar a plataforma educacional inclusiva.',
  audience:'Alunos e professores', keyMessage:'Norya é uma plataforma educacional da Lumos Connect.',
  cta:'Saiba mais', sourceNotes:'Informação validada pela equipe Lumos.',
  formats:['feed','story'], confirmed:true, artDirection:'Editorial moderno, paleta verde, fundo artístico.',
};

beforeAll(async () => {
  await initDb({memory:true});
  await seedDatabase();
  creator = (await request(app).post('/api/auth/login').send({userId:'u-ana'})).body.token;
  reviewer = (await request(app).post('/api/auth/login').send({userId:'u-rui'})).body.token;
  id = (await request(app).post('/api/institutional').set('authorization',auth(creator)).send(input)).body.id;
});
afterAll(() => { env.cloudflare.token=originalToken;env.cloudflare.accountId=originalAccountId;env.image.enabled=originalEnabled;env.image.generationSecret=originalSecret;globalThis.fetch=originalFetch; });

describe('arte institucional via IA real', () => {
  it('inclui identidade da marca e direção de arte no prompt', async () => {
    const campaign = (await request(app).get(`/api/institutional/${id}`).set('authorization',auth(creator))).body;
    const prompt = buildBrandArtworkPrompt(campaign,'feed');
    expect(prompt).toContain('#09252D');
    expect(prompt).toContain('contemporary learning workspace');
    expect(prompt).toContain('NOT an advertisement');
    expect(prompt).toContain('No letters, no text');
    expect(prompt).toContain('Editorial moderno');
    // Brand names and prose guidelines can be rendered as unwanted lettering by FLUX.
    const neutral = buildBrandArtworkPrompt({...campaign, brand:{...campaign.brand,name:'SENTINEL_BRAND',guidelines:'SENTINEL_GUIDELINES'}},'feed');
    expect(neutral).not.toContain('SENTINEL_BRAND');
    expect(neutral).not.toContain('SENTINEL_GUIDELINES');
    const long = {...campaign,brand:{...campaign.brand,description:'D'.repeat(1500),tone:'T'.repeat(300),guidelines:'G'.repeat(3000)},input:{...campaign.input,objective:'O'.repeat(650),audience:'A'.repeat(240),keyMessage:'M'.repeat(220),artDirection:'ARTE '.repeat(160)}};
    const bounded = buildBrandArtworkPrompt(long,'story');
    expect(bounded.length).toBeLessThanOrEqual(2048);
    expect(bounded).toContain('No letters, no text');
    expect(bounded).toContain('USER ART DIRECTION: ARTE');
  });
  it('exige configuração, autenticação e permissão para consumir a cota de IA', async () => {
    env.cloudflare.token=''; env.cloudflare.accountId='account-test'; env.image.enabled=true; env.image.generationSecret='test-secret';
    expect(imageAIStatus().configured).toBe(false);
    expect((await request(app).post(`/api/institutional/${id}/art/feed`)).status).toBe(401);
    const response=await request(app).post(`/api/institutional/${id}/art/feed`).set('authorization',auth(creator));
    expect(response.status).toBe(403); // Missing second secret prevents API use
  });
  it('gera, salva e pré-visualiza imagem real simulando somente a resposta HTTP da API', async () => {
    env.cloudflare.token='test-only-not-a-real-key';env.cloudflare.accountId='account-test';env.image.enabled=true;env.image.generationSecret='test-secret';
    const mockFetch = vi.fn(async (_url: string, init?:RequestInit) => {
      expect(init?.headers).toMatchObject({authorization:'Bearer test-only-not-a-real-key'});
      const requestBody = JSON.parse(init?.body as string);
      expect(requestBody.steps).toBe(4);
      expect(requestBody.prompt).not.toContain('Lumos Connect');
      return new Response(JSON.stringify({success:true,result:{image:fakePng.toString('base64')}}),{status:200});
    });
    globalThis.fetch=mockFetch as unknown as typeof fetch;
    const generated = await request(app).post(`/api/institutional/${id}/art/feed`).set('authorization',auth(creator)).set('x-image-generation-secret','test-secret');
    expect(generated.status).toBe(200);
    expect(generated.body.artworks.feed.model).toBe(env.image.model);
    expect(generated.body.status).toBe('rascunho');
    const preview=await request(app).get(`/api/institutional/${id}/preview/feed`).set('authorization',auth(creator));
    expect(preview.body.svg).toContain('data:image/png;base64,');
    expect(preview.body.svg).toContain('Lumos Connect');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(verifyGeneratedPng(fakePng.toString('base64'))).toHaveLength(fakePng.length);
    vi.restoreAllMocks();
    globalThis.fetch=originalFetch;
  });
  it('revoga a aprovação quando uma arte é regenerada', async () => {
    const ok = await request(app).post(`/api/institutional/${id}/review`).set('authorization',auth(reviewer)).send({decision:'aprovada'});
    expect(ok.status).toBe(200);
    globalThis.fetch = (async () => new Response(JSON.stringify({success:true,result:{image:fakePng.toString('base64')}}),{status:200})) as typeof fetch;
    const regenerated = await request(app).post(`/api/institutional/${id}/art/feed`).set('authorization',auth(creator)).set('x-image-generation-secret','test-secret');
    expect(regenerated.status).toBe(200);
    expect(regenerated.body.status).toBe('rascunho');
    expect(regenerated.body.reviewedBy).toBeNull();
    globalThis.fetch=originalFetch;
  });
});
