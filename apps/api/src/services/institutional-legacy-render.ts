import type { InstitutionalCampaign, InstitutionFormat } from './institutional.service';
import { fontFaces } from './render.service';
const specs={feed:{width:1080,height:1080},portrait:{width:1080,height:1350},story:{width:1080,height:1920},banner:{width:1920,height:1080}};
const xml = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function estimatedWidth(text: string, size: number): number {
  return Array.from(text).reduce((sum,ch)=>sum+( /[MW@#%]/.test(ch) ? 0.98 : /[il.,'!|:;]/.test(ch) ? 0.3 : ch===' ' ? 0.32 : 0.62),0)*size;
}
function wrap(text: string, width: number, size: number): string[] {
  const lines: string[]=[];
  let line='';
  for (const token of text.split(/\s+/).filter(Boolean)) {
    if (line && estimatedWidth(`${line} ${token}`,size)>width) {lines.push(line);line='';}
    // Break unusually long tokens without dropping any of their characters.
    for (const ch of token) {
      if (estimatedWidth(line+ch,size)>width && line) {lines.push(line);line='';}
      line+=ch;
    }
    line+=' ';
  }
  if(line.trim()) lines.push(line.trim());
  return lines.map((l)=>l.trim());
}
function fitText(text:string,width:number,initialSize:number,maxLines:number) {
  let size=initialSize;
  while(size>18 && wrap(text,width,size).length>maxLines) size-=2;
  return {size,lines:wrap(text,width,size)};
}
function textLines(lines: string[], x: number, y: number, size: number, leading: number, color: string, weight = 700, font = 'Inter') {
  return lines.map((line, i) => `<text x="${x}" y="${y + i * leading}" fill="${color}" font-size="${size}" font-weight="${weight}" font-family="${font}, Arial, sans-serif">${xml(line)}</text>`).join('');
}
function textFill(background: string): string {
  // Calculate WCAG relative luminance for solid brand backgrounds.
  const rgb = [1, 3, 5].map((i) => parseInt(background.slice(i, i + 2),16) / 255).map((n) => n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4);
  return (rgb[0]*0.2126 + rgb[1]*0.7152 + rgb[2]*0.0722) > 0.2 ? '#15232A' : '#FFFFFF';
}
export function legacyInstitutionalSvg(c: InstitutionalCampaign, f: InstitutionFormat, artworkDataUri?: string): string {
  const { width:w, height:h } = specs[f];
  const primary = c.brand.colors[0] ?? '#09252D';
  const accent = c.brand.colors[1] ?? '#4E6F5A';
  const fg = textFill(primary);
  const roomy = f === 'story';
  const wide = f === 'banner';
  const margin = wide ? 120 : 95;
  const textWidth = wide ? 1230 : w-margin*2;
  const heading = fitText(c.copies.headline,textWidth,wide?80:roomy?80:70,roomy?4:3);
  const commercial = c.catalogItem ? `${c.catalogItem.name}${c.catalogItem.priceCents!==null ? ' — '+new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c.catalogItem.priceCents/100) : ''}${c.catalogItem.conditions ? '. '+c.catalogItem.conditions : ''}` : '';
  const bodyText = [c.copies.subtitle,commercial].filter(Boolean).join(' · ');
  const bottomY = roomy ? 1630 : 890;
  const logo = c.brand.logoDataUri && /^data:image\/(png|jpeg|webp);base64,/.test(c.brand.logoDataUri) ? `<image href="${xml(c.brand.logoDataUri)}" x="${margin}" y="${roomy ? 125 : 72}" width="140" height="140" preserveAspectRatio="xMinYMid meet"/>` : '';
  const brandX = logo ? margin + 160 : margin;
  const brandTitle = fitText(c.brand.name,w-brandX-margin,wide?48:40,2);
  const audience = fitText(c.input.audience.toUpperCase(),w-margin*2,24,2);
  const headY = Math.max(roomy?590:350,(roomy?380:280)+audience.lines.length*audience.size*1.2+45);
  const bodyY = headY+heading.lines.length*heading.size*1.14+42;
  const bodyHeight = bottomY-100-bodyY;
  let bodySize=wide?38:roomy?44:36;
  while(bodySize>10 && wrap(bodyText,textWidth,bodySize).length*bodySize*1.3>bodyHeight) bodySize-=1;
  const subtitle = {lines:wrap(bodyText,textWidth,bodySize),size:bodySize};
  const actionWidth = Math.min(w-margin*2,wide?900:810);
  const action = fitText(c.copies.cta,actionWidth-70,wide?39:35,2);
  const footer = fitText(c.brand.website ? new URL(c.brand.website).hostname : c.brand.name,w-margin*2,26,2);
  const font = xml(c.brand.fontFamily || 'Inter');
  const art = artworkDataUri
    ? `<image data-background="true" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" href="${xml(artworkDataUri)}"/>`
    : `<circle cx="${w*0.87}" cy="${h*0.73}" r="${wide ? 420 : 370}" fill="${accent}" opacity="0.29"/>
       <circle cx="${w*0.98}" cy="${h*0.79}" r="${wide ? 230 : 220}" fill="${accent}" opacity="0.32"/>
       <circle cx="${w*0.9}" cy="${h*0.16}" r="${wide ? 95 : 85}" fill="${accent}" opacity="0.32"/>`;
  const brandOverlay = artworkDataUri
    ? `<defs><linearGradient id="brand-copy-overlay"><stop offset="0%" stop-color="${primary}" stop-opacity="0.98"/><stop offset="48%" stop-color="${primary}" stop-opacity="0.94"/><stop offset="75%" stop-color="${primary}" stop-opacity="0.45"/><stop offset="100%" stop-color="${primary}" stop-opacity="0.07"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#brand-copy-overlay)"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Peça ${xml(c.name)}">
  <defs><style>${fontFaces()}</style></defs>
  <rect width="${w}" height="${h}" fill="${primary}"/>
  ${art}
  ${brandOverlay}
  <line x1="${margin}" y1="${roomy ? 310 : 230}" x2="${w-margin}" y2="${roomy ? 310 : 230}" stroke="${fg}" opacity="0.22" stroke-width="2"/>
  ${logo}
  ${textLines(brandTitle.lines,brandX,roomy?215:145,brandTitle.size,brandTitle.size*1.2,fg,700,font)}
  ${textLines(audience.lines,margin,roomy?380:280,audience.size,audience.size*1.2,fg,500,font)}
  ${textLines(heading.lines,margin,headY,heading.size,heading.size*1.14,fg,800,font)}
  ${textLines(subtitle.lines,margin,headY+heading.lines.length*heading.size*1.14+42,subtitle.size,subtitle.size*1.3,fg,400,font)}
  <rect x="${margin}" y="${bottomY-55}" rx="22" width="${actionWidth}" height="126" fill="${fg}"/>
  ${textLines(action.lines,margin+35,bottomY+(action.lines.length===1?25:0),action.size,action.size*1.15,primary,700,font)}
  ${textLines(footer.lines,margin,h-72,footer.size,footer.size*1.15,fg,400,font)}
  </svg>`;
}

