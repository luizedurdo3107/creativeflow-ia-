import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { initDb } from '../src/db/client';
import { seedDatabase } from '../src/db/seed';

const app = createApp();
let admin = '';
let creator = '';
beforeAll(async () => {
  await initDb({ memory: true });
  await seedDatabase();
  admin = (await request(app).post('/api/auth/login').send({ userId:'u-bia' })).body.token;
  creator = (await request(app).post('/api/auth/login').send({ userId:'u-ana' })).body.token;
});
describe('cadastro de marcas', () => {
  it('lista Lumos inicialmente', async () => {
    const r = await request(app).get('/api/system/brand-profiles').set('Authorization', `Bearer ${creator}`);
    expect(r.status).toBe(200);
    expect(r.body.some((b: {id:string}) => b.id === 'lumos-connect')).toBe(true);
  });
  it('exige autorização e valida cores', async () => {
    const payload = {id:'teste',name:'Teste Marca',description:'Descrição institucional verdadeira',colors:['#123456'],tone:'Acolhedor',guidelines:''};
    expect((await request(app).put('/api/system/brand-profiles').set('Authorization', `Bearer ${creator}`).send(payload)).status).toBe(403);
    expect((await request(app).put('/api/system/brand-profiles').set('Authorization', `Bearer ${admin}`).send({...payload, colors:['red']})).status).toBeGreaterThanOrEqual(400);
    expect((await request(app).put('/api/system/brand-profiles').set('Authorization', `Bearer ${admin}`).send(payload)).status).toBe(200);
    const listed = await request(app).get('/api/system/brand-profiles').set('Authorization', `Bearer ${creator}`);
    expect(listed.body.some((b:{id:string}) => b.id === 'teste')).toBe(true);
  });
});
