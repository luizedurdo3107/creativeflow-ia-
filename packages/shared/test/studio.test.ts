import {describe,it,expect} from 'vitest';
import {StudioDesign,defaultStudioDesign,renderStudioSvg,studioLayerBox,rasterDimensions} from '../src/studio';
const brand={name:'Marca <script>alert(1)</script>',colors:['#112233'],fontFamily:'Inter'};
const copies={headline:'Título com várias palavras para selecionar',subtitle:'Texto de apoio verificado.',cta:'Conheça a marca'};
describe('composição editável compartilhada',()=>{
 it('encaixa um mascote inteiro sem cortar a imagem nem ocultar os textos e preserva o padrão antigo',()=>{
  const bytes=new Uint8Array(24);bytes.set([137,80,78,71]);const view=new DataView(bytes.buffer);view.setUint32(16,1024);view.setUint32(20,1536);
  const image='data:image/png;base64,'+btoa(String.fromCharCode(...bytes));
  const design=defaultStudioDesign(brand,'banner');
  const {imageFit,...legacy}=design;expect(StudioDesign.parse(legacy).imageFit).toBe('cover');
  for(const format of ['feed','portrait','story','banner'] as const){
   const svg=renderStudioSvg({brand,copies,audience:'',format,design:{...defaultStudioDesign(brand,format),imageFit:'contain'},image});
   const match=svg.match(/data-background="true"[^>]*x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/)!;
   expect(match).not.toBeNull();const [x,y,w,h]=match.slice(1).map(Number);
   const dims={feed:[1080,1080],portrait:[1080,1350],story:[1080,1920],banner:[1920,1080]}[format];
   expect(x).toBeGreaterThanOrEqual(0);expect(y).toBeGreaterThanOrEqual(0);expect(x+w).toBeLessThanOrEqual(dims[0]);expect(y+h).toBeLessThanOrEqual(dims[1]);
   expect(w/h).toBeCloseTo(2/3);expect(svg).toContain('data-layer="headline"');
  }
 });
 it('escapa os textos e mantém a ordem das camadas após serialização do banco',()=>{
  const design=defaultStudioDesign(brand,'feed');const scene={brand,copies,audience:'Público interno do briefing',format:'feed' as const,design};
  const svg=renderStudioSvg(scene);expect(svg).not.toContain('<script>');expect(svg).toContain('&lt;script&gt;');expect(svg).not.toContain('Público interno do briefing');
  const reordered={...design,layers:Object.fromEntries(Object.entries(design.layers).reverse())} as typeof design;
  expect(renderStudioSvg({...scene,design:reordered})).toBe(svg);
 });
 it('recusa posições fora da arte e oferece área de seleção com todas as linhas do título',()=>{
  const design=defaultStudioDesign(brand,'feed');expect(StudioDesign.safeParse({...design,layers:{...design.layers,headline:{...design.layers.headline,x:90,width:50}}}).success).toBe(false);
  const box=studioLayerBox(design,'headline','feed',copies);expect(box.height).toBeGreaterThan(design.layers.headline.size*2/1080*100);
 });
 it('enquadra imagens em sua proporção real, mesmo sem aumentar o zoom',()=>{
  const bytes=new Uint8Array(24);bytes.set([137,80,78,71]);const v=new DataView(bytes.buffer);v.setUint32(16,1200);v.setUint32(20,600);
  const image='data:image/png;base64,'+btoa(String.fromCharCode(...bytes));expect(rasterDimensions(image)).toEqual({width:1200,height:600});
  const design=defaultStudioDesign(brand,'feed');const scene={brand,copies,audience:'',format:'feed' as const,design,image};
  const left=renderStudioSvg({...scene,design:{...design,imageX:0}});const right=renderStudioSvg({...scene,design:{...design,imageX:100}});expect(left).not.toBe(right);expect(left).toContain('clip-path="url(#studio-image)"');
 });
 it('preserva uma arte completa no retrato 4:5, sem recortar nem duplicar textos',()=>{
  const bytes=new Uint8Array(24);bytes.set([137,80,78,71]);const view=new DataView(bytes.buffer);view.setUint32(16,1200);view.setUint32(20,600);
  const image='data:image/png;base64,'+btoa(String.fromCharCode(...bytes));
  const design=defaultStudioDesign(brand,'portrait','artwork');
  expect(StudioDesign.safeParse(design).success).toBe(true);
  expect(Object.values(design.layers).every(layer=>!layer.visible)).toBe(true);
  const svg=renderStudioSvg({brand,copies,audience:'',format:'portrait',design,image});
  expect(svg).toContain('width="1080" height="1350"');
  expect(svg).toContain('x="0" y="405" width="1080" height="540"');
  expect(svg).not.toContain('data-layer="headline"');
  expect(svg).not.toContain('<text');
 });

});
