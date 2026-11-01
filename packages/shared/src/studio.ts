import { z } from 'zod';

export const STUDIO_FORMATS = {feed:{width:1080,height:1080,label:'Quadrado'},portrait:{width:1080,height:1350,label:'Retrato 4:5'},story:{width:1080,height:1920,label:'Vertical'},banner:{width:1920,height:1080,label:'Horizontal'}} as const;
export type StudioFormat = keyof typeof STUDIO_FORMATS;
export const CHANNELS = [
  {id:'instagram',label:'Instagram',formats:['feed','portrait','story']},
  {id:'facebook',label:'Facebook',formats:['feed','portrait','story']},
  {id:'linkedin',label:'LinkedIn',formats:['feed','portrait']},
  {id:'whatsapp',label:'WhatsApp',formats:['feed','portrait','story']},
  {id:'email',label:'E-mail',formats:['banner']},
  {id:'site',label:'Site',formats:['banner']},
] as const;
export const ChannelId = z.enum(['instagram','facebook','linkedin','whatsapp','email','site']);
export type ChannelId = z.infer<typeof ChannelId>;
export const ChannelTexts = z.record(ChannelId,z.object({text:z.string().trim().min(2).max(2000),subject:z.string().trim().max(90).optional()}));
const hex=z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const LayerId=z.enum(['brand','logo','headline','subtitle','cta','footer','audience']);
export type LayerId=z.infer<typeof LayerId>;
export const STUDIO_LAYERS=LayerId.options;
export const LAYER_LABELS:Record<LayerId,string>={brand:'Nome da marca',logo:'Logotipo',headline:'Título',subtitle:'Texto de apoio',cta:'Botão de chamada',footer:'Rodapé',audience:'Público-alvo'};
export const StudioLayer=z.object({x:z.number().min(0).max(95),y:z.number().min(0).max(95),width:z.number().min(5).max(94),size:z.number().min(12).max(180),visible:z.boolean(),align:z.enum(['left','center','right'])}).refine(l=>l.x+l.width<=100,'O elemento precisa ficar dentro da arte.');
export type StudioLayer=z.infer<typeof StudioLayer>;
export const StudioDesign=z.object({
  template:z.enum(['split','editorial','poster','artwork']),background:hex,foreground:hex,accent:hex,font:z.enum(['Inter','Poppins','Nunito','Arial']),
  showImage:z.boolean(),imageFit:z.enum(['cover','contain']).default('cover'),imageX:z.number().min(0).max(100),imageY:z.number().min(0).max(100),imageZoom:z.number().min(1).max(3),overlay:z.number().min(0).max(85),
  imageStyle:z.enum(['photo','illustration','abstract']),imageSubject:z.string().trim().max(500),
  layers:z.object({brand:StudioLayer,logo:StudioLayer,headline:StudioLayer,subtitle:StudioLayer,cta:StudioLayer,footer:StudioLayer,audience:StudioLayer}),
});
export type StudioDesign=z.infer<typeof StudioDesign>;
export function defaultStudioDesign(brand:{colors:string[];fontFamily?:string;logoDataUri?:string},f:StudioFormat,template:StudioDesign['template']='split'):StudioDesign {
 const story=f==='story',wide=f==='banner',poster=template==='poster',editorial=template==='editorial',artwork=template==='artwork';
 const column=poster?84:story?84:wide?44:48;
 const layer=(x:number,y:number,width:number,size:number,visible=true):StudioLayer=>({x,y,width,size,visible,align:'left'});
 const result:StudioDesign={template,background:poster?(brand.colors[0]??'#102B35'):'#F8FAF9',foreground:poster?'#FFFFFF':'#122B35',accent:brand.colors[0]??'#135E57',font:(brand.fontFamily??'Inter') as StudioDesign['font'],showImage:true,imageFit:'cover',imageX:50,imageY:50,imageZoom:1,overlay:poster?65:0,imageStyle:'photo',imageSubject:'',layers:{
  brand:layer(brand.logoDataUri?23:8,8,60,wide?36:28),logo:layer(8,7,12,100,!!brand.logoDataUri),
  headline:layer(8,story?23:editorial?17:27,editorial?84:column,wide?82:story?80:62),
  subtitle:layer(8,story?45:editorial?37:52,editorial?84:column,wide?34:story?38:30),
  cta:layer(8,story?85:83,wide?35:story?70:48,wide?32:28),footer:layer(8,94,84,22),audience:layer(8,18,column,20,false),
 }};
 if(artwork){result.background=brand.colors[3]??'#F5F3EC';for(const key of STUDIO_LAYERS)result.layers[key].visible=false;}
 return result;
}
export function studioLayerBox(d:StudioDesign,key:LayerId,f:StudioFormat,copy:{headline:string;subtitle:string;cta:string},commercial=''){
 const {width:w,height:h}=STUDIO_FORMATS[f];const l=d.layers[key];
 const text=key==='headline'?copy.headline:key==='subtitle'?[copy.subtitle,commercial].filter(Boolean).join(' · '):key==='cta'?copy.cta:'';
 const lines=key==='logo'?1:Math.max(1,wrap(text,l.width*w/100-(key==='cta'?48:0),l.size).length);
 return {x:l.x,y:l.y,width:l.width,height:Math.min(100-l.y,key==='logo'?l.size/h*100:key==='cta'?(l.size*Math.max(1,lines)*1.25+48)/h*100:Math.max(l.size*1.25,lines*l.size*1.28)/h*100)};
}
const onColor=(hex:string)=>{const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.179?'#102B35':'#FFFFFF';};
const xml=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function wrap(text:string,width:number,size:number){
 const rows:string[]=[];let line='';let used=0;
 for(const word of text.split(/\s+/).filter(Boolean)){
  const length=Array.from(word).reduce((n,ch)=>n+(/[MW@%]/.test(ch)?.9:/[il.,!|:;]/.test(ch)?.27:.56),0)*size;
  if(line&&used+length+size*.3>width){rows.push(line.trim());line='';used=0;}
  for(const ch of word){const cw=(/[MW@%]/.test(ch)?.9:/[il.,!|:;]/.test(ch)?.27:.56)*size;if(line&&used+cw>width){rows.push(line.trim());line='';used=0;}line+=ch;used+=cw;}
  line+=' ';used+=size*.3;
 }
 if(line.trim())rows.push(line.trim());return rows;
}
export interface StudioScene {brand:{name:string;colors:string[];website?:string;logoDataUri?:string;fontFamily?:string};copies:{headline:string;subtitle:string;cta:string};audience:string;commercial?:string;format:StudioFormat;design:StudioDesign;image?:string;fontCss?:string}
export function renderStudioSvg(s:StudioScene):string{
 const {width:w,height:h}=STUDIO_FORMATS[s.format],d=s.design;const story=s.format==='story';
 const imageRect=(d.template==='poster'||d.template==='artwork')?{x:0,y:0,w,h}:d.template==='editorial'?{x:w*.08,y:h*.52,w:w*.84,h:h*.24}:story?{x:w*.08,y:h*.58,w:w*.84,h:h*.22}:{x:w*.60,y:h*.19,w:w*.34,h:h*.56};
 const r=imageRect,zoom=d.imageZoom;let image='';
 const dimensions=s.image?rasterDimensions(s.image):null;const ratio=dimensions?dimensions.width/dimensions.height:1;const baseW=(d.template==='artwork'||d.imageFit==='contain')?Math.min(r.w,r.h*ratio):Math.max(r.w,r.h*ratio),baseH=baseW/ratio;const iw=baseW*zoom,ih=baseH*zoom;
 if(d.showImage){
  const content=s.image?`<image data-background="true" href="${xml(s.image)}" x="${r.x-(iw-r.w)*d.imageX/100}" y="${r.y-(ih-r.h)*d.imageY/100}" width="${iw}" height="${ih}" preserveAspectRatio="xMidYMid slice"/>`:`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${d.accent}"/><circle cx="${r.x+r.w*.8}" cy="${r.y+r.h*.25}" r="${r.w*.48}" fill="${d.background}" opacity=".17"/><path d="M ${r.x-r.w*.1} ${r.y+r.h*.8} Q ${r.x+r.w*.5} ${r.y+r.h*.2} ${r.x+r.w*1.1} ${r.y+r.h*.6} L ${r.x+r.w*1.1} ${r.y+r.h*1.1} L ${r.x-r.w*.1} ${r.y+r.h*1.1} Z" fill="${d.background}" opacity=".2"/>`;
  image=`<g clip-path="url(#studio-image)">${content}${d.overlay?`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${d.template==='poster'?'#081B25':d.background}" opacity="${d.overlay/100}"/>`:''}</g>`;
 }
 let footer=s.brand.name;try{if(s.brand.website)footer=new URL(s.brand.website).hostname;}catch{/* validated brand URL normally handles this */}
 const values:Record<Exclude<LayerId,'logo'>,string>={brand:s.brand.name,headline:s.copies.headline,subtitle:[s.copies.subtitle,s.commercial].filter(Boolean).join(' · '),cta:s.copies.cta,footer,audience:s.audience};
 const layers=STUDIO_LAYERS.map(key=>{
  const l=d.layers[key];if(!l.visible)return '';const x=l.x*w/100,y=l.y*h/100,width=l.width*w/100;
  if(key==='logo')return s.brand.logoDataUri?`<image data-layer="logo" href="${xml(s.brand.logoDataUri)}" x="${x}" y="${y}" width="${width}" height="${l.size}" preserveAspectRatio="xMinYMin meet"/>`:'';
  const button=key==='cta',pad=button?24:0;let size=l.size,rows=wrap(values[key],width-pad*2,size);let available=h-y-(key==='footer'?12:36);
  if(key==='headline'&&d.layers.subtitle.visible&&d.layers.subtitle.y>l.y)available=Math.min(available,(d.layers.subtitle.y-l.y)*h/100-20);
  if(key==='subtitle'){if(d.layers.cta.visible&&d.layers.cta.y>l.y)available=Math.min(available,(d.layers.cta.y-l.y)*h/100-25);if(d.template==='editorial'&&l.y<52)available=Math.min(available,h*.52-y-25);if(story&&d.template==='split'&&l.y<58)available=Math.min(available,h*.58-y-25);}
  while(size>12&&rows.length*size*1.28+pad*2>available){size--;rows=wrap(values[key],width-pad*2,size);}
  const anchor=l.align==='center'?'middle':l.align==='right'?'end':'start',tx=l.align==='center'?x+width/2:l.align==='right'?x+width-pad:x+pad;
  const bg=button?`<rect x="${x}" y="${y}" width="${width}" height="${rows.length*size*1.25+pad*2}" rx="14" fill="${d.accent}"/>`:'';
  return `<g data-layer="${key}">${bg}${rows.map((line,i)=>`<text x="${tx}" y="${y+pad+size+i*size*1.28}" text-anchor="${anchor}" font-family="${xml(d.font)}, Arial, sans-serif" font-size="${size}" font-weight="${key==='headline'?800:key==='brand'||button?700:400}" fill="${button?onColor(d.accent):d.foreground}">${xml(line)}</text>`).join('')}</g>`;
 }).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Campanha de ${xml(s.brand.name)}"><defs><style>${s.fontCss??''}</style><clipPath id="studio-image"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${(d.template==='poster'||d.template==='artwork')?0:30}"/></clipPath></defs><rect width="${w}" height="${h}" fill="${d.background}"/>${image}${layers}</svg>`;
}
export type ChannelTextMap=z.infer<typeof ChannelTexts>;

/** Reads only the small header region needed to calculate a raster crop. */
export function rasterDimensions(uri:string):{width:number;height:number}|null{
 try{
  const base=uri.slice(uri.indexOf(',')+1);const raw=atob(base.slice(0,Math.min(base.length,65536)));const b=Uint8Array.from(raw,c=>c.charCodeAt(0));const view=new DataView(b.buffer);
  if(b.length>=24&&b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71)return {width:view.getUint32(16),height:view.getUint32(20)};
  if(b[0]===255&&b[1]===216){let p=2;while(p+8<b.length){if(b[p]!==255){p++;continue;}const marker=b[p+1];p+=2;if(marker===216||marker===217)continue;const length=view.getUint16(p);if(length<2)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return {width:view.getUint16(p+5),height:view.getUint16(p+3)};p+=length;}}
 }catch{/* Invalid uploads are rejected by the server. */}
 return null;
}
