import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Plus } from 'lucide-react';
import { api, ApiError, type BrandCatalogItem, type BrandCatalogImport } from '../api/client';
import { PageShell } from '../components/Layout';
import { can, useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';

const blank=():BrandCatalogItem=>({id:`item-${Date.now()}`,kind:'servico',name:'',description:'',priceCents:null,conditions:'',sourceNotes:'',active:true});
const money=(value:number|null)=>value===null?'Preço não informado':(value/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export function BrandCatalogPage(){
 const {user}=useAuth();const admin=can(user,'admin');const toast=useToast();const client=useQueryClient();
 const brands=useQuery({queryKey:['brand-profiles'],queryFn:api.brandProfiles});
 const [brandId,setBrandId]=useState('');
 const [item,setItem]=useState<BrandCatalogItem|null>(null);const [price,setPrice]=useState('');
 const [file,setFile]=useState<File|null>(null);const [report,setReport]=useState<BrandCatalogImport|null>(null);
 const catalog=useQuery({queryKey:['brand-catalog',brandId],queryFn:()=>api.brandCatalog(brandId),enabled:!!brandId});
 useEffect(()=>{if(brands.data?.length&&!brands.data.some(b=>b.id===brandId))setBrandId(brands.data[0].id);},[brands.data,brandId]);
 const error=(e:unknown)=>toast(e instanceof ApiError&&Array.isArray(e.details)?e.details.map((d:{message:string})=>d.message).join(' · '):(e as Error).message,'error');
 const refresh=()=>client.invalidateQueries({queryKey:['brand-catalog',brandId]});
 const save=useMutation({mutationFn:()=>{
  const normalized=price.trim().replace(',','.');
  if(normalized&&!/^\d+(?:\.\d{1,2})?$/.test(normalized))throw new Error('Informe o preço como 19,90 ou deixe vazio.');
  return api.saveBrandCatalogItem(brandId,{...item!,priceCents:normalized?Math.round(Number(normalized)*100):null});
 },onSuccess:()=>{refresh();setItem(null);toast('Item salvo no catálogo desta marca.');},onError:error});
 const imp=useMutation({mutationFn:(dryRun:boolean)=>api.importBrandCatalog(brandId,file!,dryRun),onSuccess:(r)=>{setReport(r);if(r.saved){refresh();toast(`${r.valid} itens salvos.`);}},onError:error});
 const changeBrand=(id:string)=>{setBrandId(id);setItem(null);setFile(null);setReport(null);};
 const edit=(i:BrandCatalogItem)=>{setItem({...i});setPrice(i.priceCents===null?'':(i.priceCents/100).toFixed(2).replace('.',','));};
 return <PageShell wide>
  <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-teal-700">Dados da empresa</p><h1 className="mt-1 text-3xl font-bold">Produtos e serviços</h1><p className="mt-2 text-sm text-slate-600">Cadastre fatos, preços e condições de cada marca. As campanhas utilizam uma cópia dos dados selecionados, com revisão antes da exportação.</p></div>{admin&&!!brandId&&<button className="flex items-center gap-2 rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white" onClick={()=>edit(blank())}><Plus className="h-4 w-4"/>Novo item</button>}</div>
  <label className="mb-6 block max-w-md text-sm font-semibold">Empresa<select className="input mt-1" value={brandId} onChange={e=>changeBrand(e.target.value)}>{brands.data?.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
  {!brands.isLoading&&brands.data?.length===0&&<p className="mb-4 text-sm">Cadastre sua empresa em <a className="font-semibold underline" href="/admin">Marcas e identidade</a> para adicionar produtos e serviços.</p>}
  {catalog.error&&<p role="alert" className="mb-4 text-sm text-red-700">{catalog.error.message}</p>}
  <div className="grid items-start gap-6 lg:grid-cols-2">
   <section className="space-y-3">{catalog.isLoading&&<p>Carregando catálogo...</p>}{catalog.data?.length===0&&<div className="card p-8 text-center"><Package className="mx-auto mb-3 h-8 w-8 text-slate-400"/><p className="text-sm">Nenhum item cadastrado para esta marca.</p><p className="mt-2 text-xs text-slate-500">O administrador pode cadastrar manualmente ou importar CSV/XLSX.</p></div>}
    {catalog.data?.map(i=><article className="card p-5" key={i.id}><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-teal-700">{i.kind==='servico'?'Serviço':'Produto'} · {i.active?'Ativo':'Inativo'}</p><h2 className="mt-1 font-bold">{i.name}</h2></div>{admin&&<button className="rounded-lg border px-3 py-2 text-xs" onClick={()=>edit(i)}>Editar item</button>}</div><p className="mt-2 text-sm text-slate-600">{i.description}</p><p className="mt-3 font-semibold">{money(i.priceCents)}</p>{i.conditions&&<p className="mt-1 text-xs text-slate-600">{i.conditions}</p>}<p className="mt-3 text-xs text-slate-500">Fonte: {i.sourceNotes}</p></article>)}
   </section>
   <div className="space-y-5">{item&&admin&&<form className="card space-y-3 p-5" onSubmit={e=>{e.preventDefault();save.mutate();}}><h2 className="font-bold">Cadastro do item</h2>
    <label className="block text-sm">Identificador<input required pattern="[a-zA-Z0-9_-]{2,60}" maxLength={60} className="input mt-1" value={item.id} onChange={e=>setItem({...item,id:e.target.value})}/></label>
    <label className="block text-sm">Tipo<select className="input mt-1" value={item.kind} onChange={e=>setItem({...item,kind:e.target.value as BrandCatalogItem['kind']})}><option value="servico">Serviço</option><option value="produto">Produto</option></select></label>
    <label className="block text-sm">Nome do item<input required minLength={2} maxLength={100} className="input mt-1" value={item.name} onChange={e=>setItem({...item,name:e.target.value})}/></label>
    <label className="block text-sm">Descrição<textarea required minLength={5} maxLength={400} className="input mt-1" value={item.description} onChange={e=>setItem({...item,description:e.target.value})}/></label>
    <label className="block text-sm">Preço em reais (opcional)<input inputMode="decimal" className="input mt-1" placeholder="Ex.: 19,90" value={price} onChange={e=>setPrice(e.target.value)}/></label>
    <label className="block text-sm">Condições comerciais<textarea maxLength={180} className="input mt-1" value={item.conditions} onChange={e=>setItem({...item,conditions:e.target.value})}/></label>
    <label className="block text-sm">Fonte dos dados do item<textarea required minLength={5} maxLength={600} className="input mt-1" value={item.sourceNotes} onChange={e=>setItem({...item,sourceNotes:e.target.value})}/></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.active} onChange={e=>setItem({...item,active:e.target.checked})}/>Item ativo para novas campanhas</label>
    <div className="flex gap-2"><button type="submit" disabled={save.isPending} className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Salvar item</button><button type="button" onClick={()=>setItem(null)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button></div>
   </form>}
   <section className="card space-y-3 p-5"><h2 className="font-bold">Importar catálogo da marca</h2><p className="text-sm text-slate-600">CSV ou XLSX, até 5 MB. Colunas: id, tipo, nome, descricao, preco, condicoes, fonte, ativo. O tipo é produto ou servico. O preço fica em reais; deixe vazio quando não houver.</p>
    <button className="rounded-lg border px-3 py-2 text-xs" onClick={()=>api.downloadBrandCatalogTemplate(brandId).catch(error)}>Baixar modelo CSV</button>
    {admin&&<><input aria-label="Arquivo de catálogo" type="file" accept=".csv,.xlsx" className="block w-full text-sm" onChange={e=>{setFile(e.target.files?.[0]??null);setReport(null);}}/><button disabled={!brandId||!file||imp.isPending} className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white disabled:opacity-40" onClick={()=>imp.mutate(true)}>Conferir arquivo</button></>}
    {report&&<div className="rounded-lg bg-slate-50 p-3 text-sm"><p>{report.valid} de {report.total} itens válidos · {report.saved?'salvos':'prévia sem alteração'}</p>{report.items.slice(0,20).map(i=><p key={i.id} className="mt-1 text-xs">{i.id} · {i.name} · {money(i.priceCents)}</p>)}{report.errors.map(e=><p className="mt-1 text-xs text-red-700" key={e.line}>Linha {e.line}: {e.message}</p>)}{admin&&!report.saved&&report.valid>0&&<button disabled={imp.isPending} onClick={()=>imp.mutate(false)} className="mt-3 rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white">Salvar itens válidos</button>}</div>}
   </section>
   <p className="text-xs text-slate-500">Se um item mudar depois de uma campanha ser criada, a exportação dessa campanha será bloqueada. Crie uma nova campanha para usar os dados atualizados.</p>
   </div>
  </div>
 </PageShell>;
}
