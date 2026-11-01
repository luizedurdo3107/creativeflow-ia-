import request from 'supertest';
import JSZip from 'jszip';
import {afterAll,beforeAll,describe,it,expect,vi} from 'vitest';
import {defaultStudioDesign,renderStudioSvg} from '@cf/shared';
import {createApp} from '../src/app';
import {initDb,db} from '../src/db/client';
import {seedDatabase} from '../src/db/seed';
import {closeRenderer} from '../src/services/render.service';
const app=createApp();let creator='',reviewer='',id='',revision=1;
const api=(method:'get'|'post'|'patch',path:string,who=creator)=>request(app)[method]('/api'+path).set('authorization','Bearer '+who);
const input={brandId:'lumos-connect',name:'Campanha de canais',objective:'Apresentar o projeto com dados conferidos pela equipe.',audience:'Equipe de teste',keyMessage:'Conheça o projeto cadastrado pela nossa equipe.',cta:'Conheça o projeto',sourceNotes:'Dados autorizados somente para validação local.',formats:['feed','banner'],channels:['instagram','email','site'],confirmed:true,copyMode:'briefing'};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAA00lEQVR4nAHIADf/AaZVkrk81yPrKvMezyfX+9UTHAHZOQcaoATyStf6yvUTIe4rv/rY+QApPA0W/tb09EcE+MU4KwkSAA/6sBEAC/fgG+LX5igtuuD0Agz78Qkj3Ort6Arm7vPyKuD6ARAAGSHW/wLYKvHoHtYMAuEQVkL6Bt/3HlLfsujnKwQEFRvP3dlR/tK37d3WHzL08vjcMPz7HhbYAsjdTT3u/uI/OzsY6fbmMw+4xwwbHce3BgQkEuwND9Yk+RD8LjxEzPYBUEDB++0uEyTHWGS8VMarNQAAAABJRU5ErkJggg==','base64');
beforeAll(async()=>{await initDb({memory:true});await seedDatabase();creator=(await request(app).post('/api/auth/login').send({userId:'u-ana'})).body.token;reviewer=(await request(app).post('/api/auth/login').send({userId:'u-rui'})).body.token;});
afterAll(async()=>{vi.unstubAllGlobals();await closeRenderer();await db().close();});
describe('editor manual e canais reais',()=>{
 it('um único briefing cria quatro peças e exporta somente os formatos compatíveis com cada canal',async()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  try {
   const formats=['feed','portrait','story','banner'];
   const channels=['instagram','linkedin','whatsapp','email','site'];
   const created=await api('post','/institutional').send({...input,name:'Uma mensagem em vários canais',formats,channels});
   expect(created.status).toBe(201);const c=created.body;
   expect(Object.keys(c.designs).sort()).toEqual([...formats].sort());
   const dimensions:Record<string,[number,number]>={feed:[1080,1080],portrait:[1080,1350],story:[1080,1920],banner:[1920,1080]};
   for(const format of formats){
    const preview=await api('get',`/institutional/${c.id}/preview/${format}`);
    expect(preview.status).toBe(200);
    expect(preview.body.svg).toContain(`width="${dimensions[format][0]}" height="${dimensions[format][1]}"`);
    expect(preview.body.svg).toContain(input.keyMessage.split(' ')[0]);
   }
   expect((await api('post',`/institutional/${c.id}/review`,reviewer).send({decision:'aprovada',baseRevision:c.revision})).status).toBe(200);
   const res=await api('get',`/institutional/${c.id}/export`).buffer(true).parse((res,done)=>{const chunks:Buffer[]=[];res.on('data',(chunk:Buffer)=>chunks.push(chunk));res.on('end',()=>done(null,Buffer.concat(chunks)));});
   expect(res.status).toBe(200);const zip=await JSZip.loadAsync(res.body);
   const expected:Record<string,string[]>={instagram:['feed','portrait','story'],linkedin:['feed','portrait'],whatsapp:['feed','portrait','story'],email:['banner'],site:['banner']};
   for(const channel of channels)for(const format of formats){
    const file=zip.file(`canais/${channel}/lumos-connect-${format}.png`);
    if(expected[channel].includes(format)){
     expect(file).not.toBeNull();const bytes=await file!.async('nodebuffer');
     expect([bytes.readUInt32BE(16),bytes.readUInt32BE(20)]).toEqual(dimensions[format]);
    }else expect(file).toBeNull();
   }
   expect(fetch).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
 },60000);
 it('cria com canais explícitos, não imprime o público no anúncio e recusa formatos incompatíveis',async()=>{
  expect((await api('post','/institutional').send({...input,channels:['email'],formats:['feed']})).status).toBe(400);
  const r=await api('post','/institutional').send(input);expect(r.status).toBe(201);id=r.body.id;revision=r.body.revision;expect(r.body.renderVersion).toBe(2);expect(r.body.input.channels).toEqual(input.channels);
  const preview=await api('get',`/institutional/${id}/preview/feed`);expect(preview.body.svg).not.toContain('Equipe de teste');
 });
 it('edita posição, cor e texto sem IA, preserva formatos distintos e impede sobrescrita de versão antiga',async()=>{
  const c=(await api('get',`/institutional/${id}`)).body;const design=defaultStudioDesign(c.brand,'feed');design.background='#FAF6ED';design.layers.headline.x=12;design.layers.headline.y=20;design.layers.headline.width=42;
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  const patch={baseRevision:revision,design,copies:{...c.copies,headline:'Título revisado manualmente'}};
  expect((await api('patch',`/institutional/${id}/design/feed`,reviewer).send(patch)).status).toBe(403);
  const r=await api('patch',`/institutional/${id}/design/feed`).send(patch);expect(r.status).toBe(200);revision=r.body.revision;
  expect(r.body.designs.feed.background).toBe('#FAF6ED');expect(r.body.designs.banner).toEqual(c.designs.banner);expect(fetch).not.toHaveBeenCalled();
  expect((await api('patch',`/institutional/${id}/design/feed`).send(patch)).status).toBe(409);
  const preview:string=(await api('get',`/institutional/${id}/preview/feed`)).body.svg;
  expect(preview).toContain('x="129.6"');expect(preview).toContain('#FAF6ED');expect(Array.from(preview.matchAll(/<text[^>]*>([^<]*)<\/text>/g),m=>m[1]).join(' ')).toContain('Título revisado manualmente');
  expect(preview).toBe(renderStudioSvg({brand:r.body.brand,copies:r.body.copies,audience:r.body.input.audience,format:'feed',design,fontCss:preview.match(/<style>([\s\S]*?)<\/style>/)?.[1]}));
  expect((await api('patch',`/institutional/${id}/design/feed`).send({...patch,baseRevision:revision,design:{...design,background:'url(https://unsafe.test)'}})).status).toBe(400);
  vi.unstubAllGlobals();
 });
 it('salva textos por canal sem regenerar copy ou imagens e valida os destinos',async()=>{
  const c=(await api('get',`/institutional/${id}`)).body;
  const r=await api('patch',`/institutional/${id}/distribution`).send({baseRevision:revision,channels:['instagram','email','site'],formats:['feed','banner'],channelTexts:{email:{subject:'Conheça o projeto',text:'Apresentação aprovada pela equipe.'},instagram:{text:'Texto específico para a comunidade.'}}});
  expect(r.status).toBe(200);revision=r.body.revision;expect(r.body.copies).toEqual(c.copies);expect(r.body.designs).toEqual(c.designs);
  expect((await api('patch',`/institutional/${id}/distribution`).send({baseRevision:revision,channels:['email'],formats:['feed']})).status).toBe(400);
 });
 it('recebe imagem própria com procedência correta, rejeita arquivos falsos e não usa cota de IA',async()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  expect((await api('post',`/institutional/${id}/background/feed`).field('baseRevision',revision).attach('file',Buffer.from('<svg onload="alert(1)"/>'),{filename:'fake.png',contentType:'image/png'})).status).toBe(400);
  const r=await api('post',`/institutional/${id}/background/feed`).field('baseRevision',revision).attach('file',png,{filename:'foto.png',contentType:'image/png'});expect(r.status).toBe(200);revision=r.body.revision;expect(r.body.artworks.feed.source).toBe('uploaded-image');expect(fetch).not.toHaveBeenCalled();
  const preview=(await api('get',`/institutional/${id}/preview/feed`)).body.svg;expect(preview).toContain('data-background="true"');expect(preview).toContain('data:image/png;base64');
  expect((await api('post',`/institutional/${id}/background/feed`).field('baseRevision',1).attach('file',png,{filename:'foto.png',contentType:'image/png'})).status).toBe(409);vi.unstubAllGlobals();
 });
 it('exporta as peças aprovadas e textos nos canais escolhidos, e qualquer edição revoga a aprovação',async()=>{
  expect((await api('post',`/institutional/${id}/review`,reviewer).send({decision:'aprovada',baseRevision:revision})).status).toBe(200);
  const res=await api('get',`/institutional/${id}/export`).buffer(true).parse((res,done)=>{const chunks:Buffer[]=[];res.on('data',(c:Buffer)=>chunks.push(c));res.on('end',()=>done(null,Buffer.concat(chunks)));});expect(res.status).toBe(200);
  const zip=await JSZip.loadAsync(res.body);expect(zip.file('canais/instagram/lumos-connect-feed.png')).not.toBeNull();expect(zip.file('canais/email/lumos-connect-banner.png')).not.toBeNull();expect(zip.file('canais/email/lumos-connect-feed.png')).toBeNull();expect(await zip.file('canais/email/texto.txt')!.async('string')).toContain('Assunto: Conheça o projeto');
  const manifest=JSON.parse(await zip.file('manifest.json')!.async('string'));expect(manifest.channels).toEqual(input.channels);expect(manifest.designs.feed.background).toBe('#FAF6ED');expect(manifest.artworkProvenance.feed.source).toBe('imagem enviada pela equipe');
  const c=(await api('get',`/institutional/${id}`)).body;const changed=await api('patch',`/institutional/${id}/design/feed`).send({baseRevision:c.revision,design:{...c.designs.feed,foreground:'#112233'}});expect(changed.body.status).toBe('rascunho');expect(changed.body.reviewedBy).toBeNull();expect((await api('get',`/institutional/${id}/export`)).status).toBe(409);
 },60000);
 it('salva e exporta arte pronta 4:5 sem IA e com revisão independente',async()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  const created=await api('post','/institutional').send({...input,name:'Anúncio 4:5 da empresa',channels:['instagram'],formats:['portrait']});
  expect(created.status).toBe(201);const campaign=created.body;
  const design=defaultStudioDesign(campaign.brand,'portrait','artwork');
  const edited=await api('patch',`/institutional/${campaign.id}/design/portrait`).send({baseRevision:campaign.revision,design});expect(edited.status).toBe(200);
  const uploaded=await api('post',`/institutional/${campaign.id}/background/portrait`).field('baseRevision',edited.body.revision).attach('file',png,{filename:'arte-pronta.png',contentType:'image/png'});
  expect(uploaded.status).toBe(200);expect(uploaded.body.artworks.portrait.filename).toContain('-portrait-');
  const preview=(await api('get',`/institutional/${campaign.id}/preview/portrait`)).body.svg;
  expect(preview).toContain('width="1080" height="1350"');expect(preview).not.toContain('<text');expect(preview).toContain('data-background="true"');
  expect((await api('get',`/institutional/${campaign.id}/export`)).status).toBe(409);
  expect((await api('post',`/institutional/${campaign.id}/review`,reviewer).send({decision:'aprovada',baseRevision:uploaded.body.revision})).status).toBe(200);
  const res=await api('get',`/institutional/${campaign.id}/export`).buffer(true).parse((res,done)=>{const chunks:Buffer[]=[];res.on('data',(c:Buffer)=>chunks.push(c));res.on('end',()=>done(null,Buffer.concat(chunks)));});
  expect(res.status).toBe(200);const zip=await JSZip.loadAsync(res.body);const file=await zip.file('canais/instagram/lumos-connect-portrait.png')!.async('nodebuffer');
  expect(file.readUInt32BE(16)).toBe(1080);expect(file.readUInt32BE(20)).toBe(1350);expect(fetch).not.toHaveBeenCalled();vi.unstubAllGlobals();
 },60000);

});
