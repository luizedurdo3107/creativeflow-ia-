import { type StudioDesign, type ChannelId, type ChannelTextMap } from '@cf/shared';
import { CampaignStudio } from '../components/CampaignStudio';
import { CampaignPieces } from '../components/CampaignPieces';
import { CampaignChannels, CampaignDistribution } from '../components/CampaignChannels';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, ImageIcon, Layers3, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, ApiError, type InstitutionalInput, type InstitutionalCopy, type InstitutionalCampaign, type InstitutionalFormat } from '../api/client';
import { PageShell } from '../components/Layout';
import { useAuth, can } from '../lib/auth';
import { useToast } from '../lib/toast';

const FORMATS: { id: InstitutionalFormat; title: string; dimension: string }[] = [
  { id:'feed', title:'Feed', dimension:'1080 × 1080' },
  { id:'portrait', title:'Retrato 4:5', dimension:'1080 × 1350' },
  { id:'story', title:'Story', dimension:'1080 × 1920' },
  { id:'banner', title:'Banner', dimension:'1920 × 1080' },
];
const statusLabel = (value:string) => ({rascunho:'Rascunho',em_revisao:'Em revisão',aprovada:'Aprovada',reprovada:'Ajustes solicitados'}[value]??value);
const generationLabel = (value:string) => value.startsWith('ia-')&&!value.includes('fallback')?'Textos criados com IA':'Textos do briefing (sem IA)';
const initial: InstitutionalInput = {brandId:'',name:'',objective:'',audience:'',keyMessage:'',cta:'',sourceNotes:'',artDirection:'',formats:['feed','story','banner'],channels:[],confirmed:false,copyMode:'ai'};

const inputStyle = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100';
const card = 'min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm';

export function BrandCampaignsPage() {
  const { user, config } = useAuth();
  const product=config?.appMode!=='demo';
  const notify = useToast();
  const client = useQueryClient();
  const [form, setForm] = useState<InstitutionalInput>(initial);
  const [editingBrief,setEditingBrief]=useState(false);
  const [studioDirty,setStudioDirty]=useState(false),[distributionDirty,setDistributionDirty]=useState(false);
  const [selectedId, setSelectedId] = useState<string>(()=>new URLSearchParams(location.search).get('campanha')??'');
  const [format, setFormat] = useState<InstitutionalFormat>('feed');
  const [copy, setCopy] = useState<InstitutionalCopy | null>(null);
  const [note, setNote] = useState('Conferi a identidade e as informações desta campanha.');
  const [instruction, setInstruction] = useState('');
  const [proposal, setProposal] = useState<{copy:InstitutionalCopy;baseRevision:number;provider:string}|null>(null);
  const [generationSecret, setGenerationSecret] = useState('');
  const brands = useQuery({queryKey:['brand-profiles'],queryFn:api.brandProfiles});
  const catalog = useQuery({queryKey:['brand-catalog',form.brandId],queryFn:()=>api.brandCatalog(form.brandId),enabled:!!form.brandId});
  useEffect(()=>{if(brands.data?.length&&!brands.data.some(b=>b.id===form.brandId))setForm(f=>({...f,brandId:brands.data![0].id,confirmed:false}));},[brands.data,form.brandId]);
  const system = useQuery({queryKey:['system-status'],queryFn:api.status});
  const campaigns = useQuery({queryKey:['institutional'],queryFn:api.institutional});
  useEffect(()=>{const url=new URL(location.href);if(selectedId)url.searchParams.set('campanha',selectedId);else url.searchParams.delete('campanha');history.replaceState(null,'',url);},[selectedId]);
  const selected = useQuery({queryKey:['institutional',selectedId],queryFn:()=>api.getInstitutional(selectedId),enabled:!!selectedId});
  const audit = useQuery({queryKey:['institutional-audit',selectedId],queryFn:()=>api.institutionalAudit(selectedId),enabled:!!selectedId});
  const preview = useQuery({queryKey:['institutional-preview',selectedId,format,selected.data?.updatedAt],queryFn:()=>api.previewInstitutional(selectedId,format),enabled:!!selectedId && !!selected.data});
  useEffect(()=>{ if(selected.data) {setCopy({...selected.data.copies});setProposal(null);} },[selected.data]);
  const handleError = (err: unknown) => {
    const details = err instanceof ApiError && Array.isArray(err.details) ? err.details.map((d: {message:string})=>d.message).join(' · ') : '';
    notify(details || (err as Error).message,'error');
  };
  const refresh = (id?:string) => {
    if (id) setSelectedId(id);
    client.invalidateQueries({queryKey:['institutional']});
    client.invalidateQueries({queryKey:['institutional',id??selectedId]});
    client.invalidateQueries({queryKey:['institutional-preview']});
    client.invalidateQueries({queryKey:['institutional-audit']});
    client.invalidateQueries({queryKey:['system-status']});
    client.invalidateQueries({queryKey:['usage']});
  };
  const create = useMutation({mutationFn:()=>editingBrief?api.updateInstitutionalBriefing(selectedId,form,selected.data!.revision):api.createInstitutional(form),onSuccess:(c)=>{setEditingBrief(false);setFormat(c.input.formats[0]);refresh(c.id);notify(editingBrief?'Briefing atualizado. Confira a nova versão.':'Campanha criada com base nas informações fornecidas.');},onError:handleError});
  const edit = useMutation({mutationFn:()=>api.updateInstitutionalCopy(selectedId,{...copy!,baseRevision:selected.data!.revision}),onSuccess:()=>{refresh();notify('Textos salvos. A aprovação anterior foi revogada, se existia.');},onError:handleError});
  const generate = useMutation({mutationFn:()=>api.generateInstitutional(selectedId,selected.data!.revision),onSuccess:()=>{refresh();notify('Nova versão de textos gerada.');},onError:handleError});
  const saveDesign=useMutation({mutationFn:({design,copies}:{design:StudioDesign;copies:InstitutionalCopy})=>api.updateInstitutionalDesign(selectedId,format,design,copies,selected.data!.revision),onSuccess:()=>{refresh();notify('Arte salva. Confira os formatos antes de solicitar a revisão.');},onError:handleError});
  const uploadImage=useMutation({mutationFn:(file:File)=>api.uploadInstitutionalBackground(selectedId,format,file,selected.data!.revision),onSuccess:()=>{refresh();notify('Imagem própria salva. Você pode ajustar o enquadramento no editor.');},onError:handleError});
  const distribution=useMutation({mutationFn:({channels,formats,texts}:{channels:ChannelId[];formats:InstitutionalFormat[];texts:ChannelTextMap})=>api.updateInstitutionalDistribution(selectedId,channels,formats,texts,selected.data!.revision),onSuccess:c=>{setFormat(f=>c.input.formats.includes(f)?f:c.input.formats[0]);refresh();notify('Canais e textos salvos. Uma nova revisão será necessária.');},onError:handleError});
  const generateArt = useMutation({mutationFn:(f:InstitutionalFormat)=>api.generateInstitutionalArt(selectedId,f,generationSecret),onSuccess:()=>{refresh();notify('Arte gerada com IA e salva. A campanha precisa de nova aprovação.');},onError:handleError});
  const review = useMutation({mutationFn:(decision:'aprovada'|'reprovada')=>api.reviewInstitutional(selectedId,decision,note,selected.data!.revision),onSuccess:()=>{refresh();notify('Decisão registrada.');},onError:handleError});
  const propose = useMutation({mutationFn:()=>api.proposeInstitutionalEdit(selectedId,instruction,selected.data!.revision),onSuccess:(result)=>{setProposal(result);notify('Confira a proposta antes de aplicar.');},onError:handleError});
  const applyProposal = useMutation({mutationFn:()=>api.updateInstitutionalCopy(selectedId,{...proposal!.copy,baseRevision:proposal!.baseRevision}),onSuccess:()=>{refresh();setProposal(null);setInstruction('');notify('Proposta aplicada. A campanha precisa de nova revisão.');},onError:handleError});
  const submit = useMutation({mutationFn:()=>api.submitInstitutional(selectedId,selected.data!.revision),onSuccess:(c)=>{refresh(c.id);notify('Campanha enviada para revisão.');},onError:handleError});
  const sync = useMutation({mutationFn:()=>api.syncInstitutionalReferences(selectedId,selected.data!.revision),onSuccess:()=>{refresh();notify('Dados atualizados. Confira os formatos e gere novos fundos se necessário.');},onError:handleError});
  const archive = useMutation({mutationFn:()=>api.archiveInstitutional(selectedId),onSuccess:()=>{setSelectedId('');refresh();notify('Campanha arquivada. Você pode restaurá-la nas configurações.');},onError:handleError});
  const exp = useMutation({mutationFn:()=>api.exportInstitutional(selectedId),onSuccess:()=>notify('Pacote aprovado exportado.'),onError:handleError});
  const set = <K extends keyof InstitutionalInput>(key:K,value:InstitutionalInput[K])=>setForm((x)=>({...x,[key]:value,...(key==='confirmed'?{}:{confirmed:false})}));
  const canCreate = can(user,'criador');
  const canReview = can(user,'revisor');
  const active = selected.data;
  const busy = edit.isPending || generate.isPending || generateArt.isPending || review.isPending || propose.isPending || applyProposal.isPending || exp.isPending || submit.isPending || sync.isPending || archive.isPending || saveDesign.isPending || uploadImage.isPending || distribution.isPending;
  const chosenBrand = brands.data?.find((b)=>b.id===form.brandId);
  const chooseBrand = (brandId:string) => {
    setForm({...initial,brandId,formats:[...form.formats]});
  };
  const svgSrc = preview.data ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(preview.data.svg)}` : '';

  return <PageShell wide>
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-teal-700">CreativeFlow · Campanhas</p>
        <h1 className="font-display text-3xl font-extrabold text-slate-900">Crie campanhas com dados da sua marca</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">Preencha um único briefing, escolha os canais e crie várias peças adaptadas à sua marca. Confira com a equipe e exporte os materiais aprovados.</p>
      </div>
      <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800">{chosenBrand?.name||'Seu espaço de trabalho'}</span>
    </div>
    <div className={`grid items-start gap-6 ${active&&!editingBrief?'xl:grid-cols-[260px_minmax(0,1fr)]':'xl:grid-cols-[minmax(340px,430px)_minmax(0,1fr)]'}`}>
      <div className="space-y-5">
        {(!active||editingBrief)&&<section className={card}>
          <div className="mb-4 flex items-center gap-2"><Layers3 className="h-5 w-5 text-teal-700"/><h2 className="text-lg font-bold">1. {editingBrief?'Editar briefing':'Briefing da marca'}</h2></div>
          <form className="space-y-3" onSubmit={(e)=>{e.preventDefault();create.mutate();}}>
            <label className="block text-sm font-medium">Empresa
              <select required className={`mt-1 ${inputStyle}`} value={form.brandId} onChange={(e)=>chooseBrand(e.target.value)}>
                <option value="" disabled>Selecione uma marca</option>{(brands.data??[]).map((b)=><option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            {chosenBrand && <div className="rounded-lg bg-slate-50 p-3">
              <div className="flex items-center gap-3">{chosenBrand.logoDataUri&&<img src={chosenBrand.logoDataUri} alt={`Logo de ${chosenBrand.name}`} className="h-12 w-16 object-contain"/>}<div><p className="text-sm font-semibold">{chosenBrand.name}</p><div className="mt-1 flex gap-1">{chosenBrand.colors.map((color)=><span key={color} title={color} style={{backgroundColor:color}} className="h-5 w-5 rounded border border-slate-300"/>)}</div></div></div>
              <p className="mt-2 text-xs text-slate-600">{chosenBrand.description}</p>
            </div>}
            {!brands.isLoading&&brands.data?.length===0&&<p className="rounded-lg bg-teal-50 p-3 text-sm text-teal-900">Comece cadastrando sua empresa em <a className="font-bold underline" href="/admin">Marcas e identidade</a>.</p>}
            <label className="block text-sm font-medium">Produto ou serviço (opcional)
              <select className={`mt-1 ${inputStyle}`} value={form.catalogItemId??''} onChange={(e)=>set('catalogItemId',e.target.value)}>
                <option value="">Campanha institucional sem item do catálogo</option>
                {catalog.data?.filter(i=>i.active).map(i=><option key={i.id} value={i.id}>{i.name}{i.priceCents!==null?` · ${(i.priceCents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`:''}</option>)}
              </select>
            </label>
            <p className="text-xs text-slate-500">Cadastre itens em <a className="underline" href="/marcas/catalogo">Produtos e serviços</a>. Nome, preço e condições selecionados são aplicados pelo sistema. Não digite preços nos textos livres.</p>
            <p className="text-xs text-slate-500">Configure logo, cores e informações em <a className="font-semibold underline" href="/admin">Marca e regras</a>.</p>
            {([
              ['name','Nome da campanha'], ['objective','Objetivo da campanha'], ['audience','Público-alvo'],
              ['keyMessage','Mensagem principal (informação conferida)'],['cta','Chamada para ação'], ['sourceNotes','Fonte dos dados / autorização'], ['artDirection','Direção de arte'],
            ] as const).map(([key,title]) => <label className="block text-sm font-medium" key={key}>{title}
              {key==='objective'||key==='keyMessage'||key==='sourceNotes'||key==='artDirection'
                ? <textarea required={key!=='artDirection'} minLength={key==='artDirection'?0:10} maxLength={{objective:650,keyMessage:400,sourceNotes:1500,artDirection:800}[key as 'objective'|'keyMessage'|'sourceNotes'|'artDirection']} className={`mt-1 ${inputStyle}`} rows={key==='sourceNotes'||key==='artDirection'?3:2} value={form[key]} onChange={(e)=>set(key,e.target.value)}/>
                : <input required minLength={key==='cta'?2:3} maxLength={{name:90,audience:240,cta:50}[key as 'name'|'audience'|'cta']} className={`mt-1 ${inputStyle}`} value={form[key]} onChange={(e)=>set(key,e.target.value)} />}
            </label>)}
            <label className="block text-sm font-medium">Criação dos textos<select className={`mt-1 ${inputStyle}`} value={form.copyMode??'ai'} onChange={e=>set('copyMode',e.target.value as 'ai'|'briefing')}><option value="ai">Criar com IA a partir do briefing</option><option value="briefing">Usar meus textos do briefing, sem IA</option></select></label>
            <CampaignChannels channels={form.channels??[]} formats={form.formats} onChange={(channels,formats)=>setForm(f=>({...f,channels,formats,confirmed:false}))}/>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              <input type="checkbox" className="mt-1" checked={form.confirmed} onChange={(e)=>set('confirmed',e.target.checked)}/>
              Confirmo que as informações foram conferidas e estou autorizado(a) a utilizar os materiais da marca. A IA não é fonte oficial desses fatos.
            </label>
            <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-800 px-4 py-3 font-bold text-white shadow-sm hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50" disabled={!canCreate||!form.brandId||!form.confirmed||create.isPending||form.formats.length===0||!form.channels?.length} type="submit">
              <Sparkles className="h-4 w-4"/>{create.isPending?'Preparando as peças...':editingBrief?'Salvar briefing e recriar textos':`Criar campanha com ${form.formats.length} ${form.formats.length===1?'peça':'peças'}`}</button>
            {editingBrief&&<button type="button" className="text-sm underline" onClick={()=>{setEditingBrief(false);setForm({...initial,brandId:form.brandId});}}>Cancelar edição do briefing</button>}
            {!canCreate && <p className="text-xs text-amber-700">Entre como criador ou administrador para criar.</p>}
          </form>
        </section>}
        <section className={card}>
          <h2 className="mb-3 font-bold">Campanhas salvas</h2>{active&&<button disabled={busy||studioDirty||distributionDirty} type="button" className="mb-3 w-full rounded-lg bg-teal-800 px-3 py-2 text-sm font-bold text-white disabled:opacity-40" onClick={()=>{setSelectedId('');setEditingBrief(false);setForm({...initial,brandId:form.brandId});}}>+ Nova campanha</button>}
          {campaigns.isLoading&&<p className="text-sm text-slate-500">Carregando...</p>}
          {campaigns.error&&<p className="text-sm text-red-700">Erro ao carregar campanhas.</p>}
          {campaigns.data?.length===0&&<p className="text-sm text-slate-500">Nenhuma campanha institucional criada ainda.</p>}
          <div className="space-y-2">{campaigns.data?.map((c)=><button key={c.id} disabled={busy||editingBrief||studioDirty||distributionDirty} type="button" onClick={()=>{setSelectedId(c.id);setFormat(c.input.formats[0])}} className={`block w-full rounded-lg border px-3 py-3 text-left ${selectedId===c.id?'border-teal-600 bg-teal-50':'border-slate-200 hover:bg-slate-50'}`}>
            <span className="block text-sm font-semibold">{c.name}</span>
            <span className="block text-xs text-slate-500">{c.brand.name} · {statusLabel(c.status)} · {generationLabel(c.aiMode)}</span>
          </button>)}</div>
        </section>
      </div>
      <div className="space-y-5">
        {!active && <div className={`${card} py-20 text-center`}><ImageIcon className="mx-auto mb-4 h-12 w-12 text-slate-300"/><h2 className="text-lg font-bold">Sua campanha aparecerá aqui</h2><p className="mt-2 text-sm text-slate-500">Crie ou escolha uma campanha salva para visualizar as peças.</p></div>}
        {active && <>
          <section className={card}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-wide text-teal-700">2. Produção e prévia</p><h2 className="mt-1 text-xl font-bold">{active.name}</h2>
                <p className="mt-1 text-xs text-slate-500">Marca: {active.brand.name} · Versão {active.revision} · Geração: {generationLabel(active.aiMode)} · Status: {statusLabel(active.status)}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${active.status==='aprovada'?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-800'}`}>{statusLabel(active.status)}</span>
            </div>
            {active.catalogItem&&<p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">Dados do catálogo preservados: {active.catalogItem.name}{active.catalogItem.priceCents!==null?` · ${(active.catalogItem.priceCents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`:''} · {active.catalogItem.conditions||'Sem condição adicional informada'}</p>}
            {canCreate&&<button disabled={busy||studioDirty||distributionDirty} type="button" className="mt-3 rounded-lg border px-3 py-2 text-xs" onClick={()=>{setForm({...active.input,confirmed:false});setEditingBrief(true);window.scrollTo({top:0,behavior:'smooth'});}}>Editar briefing desta campanha</button>}
            <details className="mt-3 rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold">Briefing e fontes desta campanha</summary><dl className="mt-3 space-y-2 text-xs text-slate-600"><div><dt className="font-semibold">Objetivo</dt><dd>{active.input.objective}</dd></div><div><dt className="font-semibold">Público</dt><dd>{active.input.audience}</dd></div><div><dt className="font-semibold">Mensagem conferida</dt><dd>{active.input.keyMessage}</dd></div><div><dt className="font-semibold">Fonte e autorização</dt><dd className="whitespace-pre-wrap">{active.input.sourceNotes}</dd></div><div><dt className="font-semibold">Direção de arte</dt><dd>{active.input.artDirection||'Não informada'}</dd></div></dl></details>
          </section>
          <CampaignPieces campaign={active} disabled={busy||studioDirty||distributionDirty} onEdit={f=>{setFormat(f);document.getElementById('campaign-piece-editor')?.scrollIntoView({behavior:'smooth',block:'start'});}}/>
          <section id="campaign-piece-editor" className={`${card} scroll-mt-6`}>
            <h2 className="font-bold">Editar uma peça</h2>
            <div className="mt-5 flex flex-wrap gap-2">{FORMATS.filter((f)=>active.input.formats.includes(f.id)).map((f)=><button disabled={studioDirty||distributionDirty||busy} key={f.id} onClick={()=>setFormat(f.id)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${format===f.id?'bg-teal-800 text-white':'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{f.title} · {f.dimension}</button>)}</div>
            {preview.isLoading?<p className="mt-4 p-8 text-sm">Preparando editor...</p>:preview.data?<CampaignStudio campaign={active} format={format} previewSvg={preview.data.svg} disabled={!canCreate||busy||distributionDirty} saving={saveDesign.isPending} generating={generateArt.isPending} hasAI={!!system.data?.imageAI?.configured} onDirty={setStudioDirty} onSave={(design,copies)=>saveDesign.mutateAsync({design,copies}).catch(()=>undefined)} onGenerate={()=>generateArt.mutate(format)} onUpload={file=>uploadImage.mutate(file)}/>:<p className="mt-4 text-sm text-red-700">Não foi possível preparar a arte. Atualize a página para tentar novamente.</p>}
            <p className="mt-3 text-xs text-slate-500">{active.artworks?.[format]?(active.artworks[format]?.source==='uploaded-image'?'Imagem enviada pela equipe.':'Imagem gerada por IA e salva.'):'Composição sem imagem gerada. Use a aba Imagem para gerar ou enviar uma foto.'} Cada formato tem sua composição. Salve a arte antes de trocar de formato.</p>
            {!product&&<label className="mt-3 block text-xs">Senha de geração da demonstração<input className="mt-1 rounded border p-2" type="password" value={generationSecret} onChange={e=>setGenerationSecret(e.target.value)}/></label>}
          </section>
          <section className={card}>
            <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-bold">Ajustes de texto com IA</h2>
              {canCreate&&<button disabled={busy||studioDirty||distributionDirty} onClick={()=>generate.mutate()} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-xs hover:bg-slate-50"><RefreshCw className="h-3 w-3"/> {active.input.copyMode==='briefing'?'Recriar a partir do briefing':'Regenerar textos com IA'}</button>}
            </div>
            <p className="text-sm text-slate-600">Para escrever manualmente, use a aba <strong>Texto</strong> no editor acima. Você também pode propor ajustes com IA e conferir antes de aplicar.</p>
            {canCreate&&<div className="mt-5 space-y-3 border-t border-slate-200 pt-4">
              <label className="block text-sm font-semibold">Editar por comando de texto
                <textarea className={`mt-1 ${inputStyle}`} rows={2} maxLength={800} value={instruction} onChange={(e)=>setInstruction(e.target.value)} placeholder="Ex.: Encurte o título e deixe o texto mais acolhedor, preservando os fatos."/>
              </label>
              <button type="button" disabled={busy||studioDirty||distributionDirty||instruction.trim().length<5||system.data?.ai.mode!=='ia-generativa'} onClick={()=>propose.mutate()} className="rounded-lg bg-violet-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{propose.isPending?'Preparando proposta...':'Propor edição com IA'}</button>
              {system.data?.ai.mode!=='ia-generativa'&&<p className="text-xs text-slate-600">A edição por comando fica disponível quando a IA de texto estiver configurada. Os campos acima permitem editar manualmente.</p>}
              {proposal&&<div className="space-y-3 rounded-lg border border-violet-200 bg-violet-50 p-4">
                <h3 className="text-sm font-bold">Confira as mudanças propostas</h3>
                {(['headline','subtitle','cta','caption'] as const).filter((key)=>active.copies[key]!==proposal.copy[key]).map((key)=><div key={key} className="grid gap-2 text-xs sm:grid-cols-2"><div className="rounded bg-white p-2"><span className="font-semibold">Antes</span><p className="mt-1 whitespace-pre-wrap">{active.copies[key]}</p></div><div className="rounded bg-white p-2"><span className="font-semibold">Proposta</span><p className="mt-1 whitespace-pre-wrap">{proposal.copy[key]}</p></div></div>)}
                <p className="text-xs text-violet-900">A aplicação altera o rascunho e exige nova aprovação humana.</p>
                <div className="flex gap-2"><button disabled={busy||studioDirty||distributionDirty} type="button" onClick={()=>applyProposal.mutate()} className="rounded-lg bg-violet-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Aplicar proposta</button><button type="button" disabled={busy} onClick={()=>setProposal(null)} className="rounded-lg border border-violet-300 px-3 py-2 text-xs">Descartar</button></div>
              </div>}
            </div>}
          </section>
          <CampaignDistribution campaign={active} disabled={!canCreate||busy||studioDirty} onDirty={setDistributionDirty} onSave={(channels,formats,texts)=>distribution.mutateAsync({channels,formats,texts}).catch(()=>undefined)}/>
          {(studioDirty||distributionDirty)&&<p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Há alterações não salvas. Salve a arte ou os canais antes de trocar de formato ou enviar para revisão.</p>}
          <section className={card}>
            <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-teal-700"/><h2 className="font-bold">4. Aprovação e exportação</h2></div>
            <p className="mt-2 text-sm text-slate-600">Quem criou ou fez a última edição da campanha não pode aprová-la. Depois de qualquer edição ou regeneração, é necessária uma nova aprovação.</p>
            {active.reviewedBy&&<p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">Última revisão registrada: {active.reviewNote||statusLabel(active.status)}</p>}
            {canCreate&&product&&<div className="mt-4 space-y-2"><button disabled={busy||studioDirty||distributionDirty||!active.input.channels?.length||!['rascunho','reprovada'].includes(active.status)||JSON.stringify(copy)!==JSON.stringify(active.copies)} onClick={()=>submit.mutate()} className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Enviar para revisão</button><p className="text-xs text-slate-500">Escolha os canais e salve as edições antes de enviar. Outro integrante com permissão de revisão fará a conferência.</p></div>}
            {canReview&&(!product||active.status==='em_revisao')&&<div className="mt-4 space-y-3"><label className="block text-xs font-semibold">Comentário da revisão
              <textarea className={`mt-1 ${inputStyle}`} rows={2} maxLength={500} value={note} onChange={(e)=>setNote(e.target.value)} /></label>
              <div className="flex flex-wrap gap-2"><button className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy||studioDirty||distributionDirty||active.createdBy===user?.id||active.lastEditedBy===user?.id} onClick={()=>review.mutate('aprovada')}><CheckCircle2 className="h-4 w-4"/> Aprovar</button>
              <button className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50" disabled={busy||studioDirty||distributionDirty||active.createdBy===user?.id||active.lastEditedBy===user?.id} onClick={()=>review.mutate('reprovada')}>Pedir ajustes</button></div>
              {(active.createdBy===user?.id||active.lastEditedBy===user?.id)&&<p className="text-xs text-amber-700">Outro integrante com permissão de revisão precisa conferir esta versão.</p>}
            </div>}
            <button disabled={active.status!=='aprovada'||busy||studioDirty||distributionDirty} onClick={()=>exp.mutate()} className="mt-4 flex items-center gap-2 rounded-lg bg-teal-800 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"><Download className="h-4 w-4"/>{exp.isPending?'Exportando PNG...':'Baixar pacote de peças aprovadas'}</button>
            <p className="mt-2 text-xs text-slate-500">O ZIP inclui PNGs nos formatos escolhidos, legenda e manifesto com origem da informação e aprovação.</p>
            {canCreate&&<div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4"><button disabled={busy||studioDirty||distributionDirty} onClick={()=>sync.mutate()} className="rounded-lg border px-3 py-2 text-xs">Atualizar marca e dados do catálogo</button><button disabled={busy||studioDirty||distributionDirty} onClick={()=>archive.mutate()} className="rounded-lg border px-3 py-2 text-xs text-slate-600">Arquivar campanha</button><p className="w-full text-xs text-slate-500">Atualizar os dados reinicia a revisão e retira os fundos anteriores da versão atual.</p></div>}
            <div className="mt-5 border-t border-slate-100 pt-4"><h3 className="text-sm font-semibold">Histórico de alterações</h3>
              <ul className="mt-2 space-y-1">{audit.data?.map((event,index)=><li key={`${event.createdAt}-${index}`} className="text-xs text-slate-600">{new Date(event.createdAt).toLocaleString('pt-BR')} · {event.actorName||'Integrante da equipe'} · {({arte_editada_manualmente:'Arte editada manualmente',canais_atualizados:'Canais e textos atualizados',imagem_enviada:'Imagem enviada pela equipe',criada:'Campanha criada',texto_editado:'Textos atualizados',arte_ia_gerada:'Fundo criado com IA',revisada:'Revisão registrada',enviada_para_revisao:'Enviada para revisão',exportada:'Pacote exportado',briefing_editado:'Briefing atualizado',fontes_atualizadas:'Dados de origem atualizados',restaurada:'Rascunho restaurado',regenerada:'Textos recriados',edicao_ia_proposta:'Proposta de edição criada'} as Record<string,string>)[event.action]||event.action.replaceAll('_',' ')}</li>)}</ul>
            </div>
          </section>
        </>}
      </div>
    </div>
  </PageShell>;
}
