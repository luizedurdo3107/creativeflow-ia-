import { z } from 'zod';
import { getSetting, setSetting } from '../models/governance.model';
import { listBrandProfiles } from './brand-profiles.service';
import { readRows, parseMoney } from './import.service';
import { HttpError } from '../utils/errors';

export const BrandCatalogItemSchema=z.object({
 id:z.string().regex(/^[a-zA-Z0-9_-]{2,60}$/),
 kind:z.enum(['produto','servico']),
 name:z.string().trim().min(2).max(100),
 description:z.string().trim().min(5).max(400),
 priceCents:z.number().int().min(0).max(100_000_000).nullable().default(null),
 conditions:z.string().trim().max(180).default(''),
 sourceNotes:z.string().trim().min(5).max(600),
 active:z.boolean().default(true),
});
export type BrandCatalogItem=z.infer<typeof BrandCatalogItemSchema>;
async function checkBrand(brandId:string){
 if(!(await listBrandProfiles()).some(b=>b.id===brandId)) throw new HttpError(404,'Marca não encontrada.');
}
export async function listBrandCatalog(brandId:string):Promise<BrandCatalogItem[]>{
 await checkBrand(brandId);
 return z.array(BrandCatalogItemSchema).parse(await getSetting(`brandCatalog:${brandId}`) ?? []);
}
export async function saveBrandCatalogItem(brandId:string,raw:unknown){
 const item=BrandCatalogItemSchema.parse(raw);
 const items=await listBrandCatalog(brandId);
 await setSetting(`brandCatalog:${brandId}`,[...items.filter(i=>i.id!==item.id),item]);
 return item;
}
export async function importBrandCatalog(brandId:string,buffer:Buffer,filename:string,dryRun:boolean){
 await checkBrand(brandId);
 if(!/\.(csv|xlsx)$/i.test(filename)) throw new HttpError(400,'Envie um arquivo CSV ou XLSX.');
 const rows=await readRows(buffer,filename);
 if(rows.length>500) throw new HttpError(400,'Importe até 500 itens por arquivo.');
 const items:BrandCatalogItem[]=[];
 const errors:{line:number;message:string}[]=[];
 const ids=new Set<string>();
 rows.forEach((r,index)=>{
  const normalized=Object.fromEntries(Object.entries(r).map(([k,v])=>[k.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase(),v]));
  const price=normalized.preco;
  const cents=price===undefined || price===null || String(price).trim()==='' ? null : /^(?:R\$\s*)?0(?:[.,]0{1,2})?$/.test(String(price).trim()) ? 0 : parseMoney(price);
  if(price!==undefined && String(price).trim()!=='' && cents===null){errors.push({line:index+2,message:'Preço inválido. Use valor positivo como 19,90 ou deixe vazio.'});return;}
  const parsed=BrandCatalogItemSchema.safeParse({id:String(normalized.id??'').trim(),kind:String(normalized.tipo??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase(),name:String(normalized.nome??'').trim(),description:String(normalized.descricao??'').trim(),priceCents:cents,conditions:String(normalized.condicoes??'').trim(),sourceNotes:String(normalized.fonte??'').trim(),active:!['nao','false','0','inativo'].includes(String(normalized.ativo??'true').toLowerCase())});
  if(!parsed.success){errors.push({line:index+2,message:parsed.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')});return;}
  if(ids.has(parsed.data.id)){errors.push({line:index+2,message:'Identificador duplicado no arquivo.'});return;}
  ids.add(parsed.data.id);items.push(parsed.data);
 });
 if(!dryRun && items.length){
  const previous=await listBrandCatalog(brandId);
  await setSetting(`brandCatalog:${brandId}`,[...previous.filter(i=>!ids.has(i.id)),...items]);
 }
 return {total:rows.length,valid:items.length,errors,items,saved:!dryRun&&items.length>0};
}
