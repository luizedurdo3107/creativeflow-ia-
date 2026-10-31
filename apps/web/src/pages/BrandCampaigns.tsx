import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, ImageIcon, Layers3, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, type InstitutionalInput, type InstitutionalCopy, type InstitutionalCampaign, type InstitutionalFormat } from '../api/client';
import { PageShell } from '../components/Layout';
import { useAuth, can } from '../lib/auth';
import { useToast } from '../lib/toast';

const FORMATS: { id: InstitutionalFormat; title: string; dimension: string }[] = [
  { id:'feed', title:'Feed', dimension:'1080 × 1080' },
  { id:'story', title:'Story', dimension:'1080 × 1920' },
  { id:'banner', title:'Banner', dimension:'1920 × 1080' },
];
const initial: InstitutionalInput = {
  brandId:'lumos-connect', name:'Conheça o Norya',
  objective:'Apresentar o Norya e explicar seus recursos educacionais.',
  audience:'Estudantes e educadores do ensino médio',
  keyMessage:'O Norya é uma plataforma educacional inclusiva com recursos de personalização da aprendizagem.',
  cta:'Conheça o Norya',
  sourceNotes:'Informações institucionais fornecidas pela equipe da Lumos Connect; validar com os responsáveis antes da publicação.',
  formats:['feed','story','banner'], confirmed:false,
};
const inputStyle = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100';
const card = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm';

export function BrandCampaignsPage() {
  const { user } = useAuth();
  const notify = useToast();
  const client = useQueryClient();
  const [form, setForm] = useState<InstitutionalInput>(initial);
  const [selectedId, setSelectedId] = useState<string>('');
  const [format, setFormat] = useState<InstitutionalFormat>('feed');
  const [copy, setCopy] = useState<InstitutionalCopy | null>(null);
  const [note, setNote] = useState('Conferi a identidade e as informações desta campanha.');
  const brands = useQuery({queryKey:['brand-profiles'],queryFn:api.brandProfiles});
  const campaigns = useQuery({queryKey:['institutional'],queryFn:api.institutional});
  const selected = useQuery({queryKey:['institutional',selectedId],queryFn:()=>api.getInstitutional(selectedId),enabled:!!selectedId});
  const audit = useQuery({queryKey:['institutional-audit',selectedId],queryFn:()=>api.institutionalAudit(selectedId),enabled:!!selectedId});
  const preview = useQuery({queryKey:['institutional-preview',selectedId,format,selected.data?.updatedAt],queryFn:()=>api.previewInstitutional(selectedId,format),enabled:!!selectedId && !!selected.data});
  useEffect(()=>{ if(selected.data) setCopy({...selected.data.copies}); },[selected.data]);
  const handleError = (err: unknown) => notify((err as Error).message,'error');
  const refresh = (id?:string) => {
    if (id) setSelectedId(id);
    client.invalidateQueries({queryKey:['institutional']});
    client.invalidateQueries({queryKey:['institutional',id??selectedId]});
    client.invalidateQueries({queryKey:['institutional-preview']});
    client.invalidateQueries({queryKey:['institutional-audit']});
  };
  const create = useMutation({mutationFn:()=>api.createInstitutional(form),onSuccess:(c)=>{setFormat(c.input.formats[0]);refresh(c.id);notify('Campanha criada com base nas informações fornecidas.');},onError:handleError});
  const edit = useMutation({mutationFn:()=>api.updateInstitutionalCopy(selectedId,copy!),onSuccess:()=>{refresh();notify('Textos salvos. A aprovação anterior foi revogada, se existia.');},onError:handleError});
  const generate = useMutation({mutationFn:()=>api.generateInstitutional(selectedId),onSuccess:()=>{refresh();notify('Nova versão de textos gerada.');},onError:handleError});
  const review = useMutation({mutationFn:(decision:'aprovada'|'reprovada')=>api.reviewInstitutional(selectedId,decision,note),onSuccess:()=>{refresh();notify('Decisão registrada.');},onError:handleError});
  const exp = useMutation({mutationFn:()=>api.exportInstitutional(selectedId),onSuccess:()=>notify('Pacote aprovado exportado.'),onError:handleError});
  const set = <K extends keyof InstitutionalInput>(key:K,value:InstitutionalInput[K])=>setForm((x)=>({...x,[key]:value}));
  const canCreate = can(user,'criador');
  const canReview = can(user,'revisor');
  const active = selected.data;
  const svgSrc = preview.data ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(preview.data.svg)}` : '';

  return <PageShell wide>
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-teal-700">CreativeFlow Connect · Campanhas institucionais</p>
        <h1 className="font-display text-3xl font-extrabold text-slate-900">Crie campanhas com dados da sua marca</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">Jornada independente da farmácia: briefing verdadeiro, perfil visual, revisão humana e exportação em PNG. O material só deve ser publicado após aprovação da marca.</p>
      </div>
      <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800">Ambiente piloto · Lumos Connect</span>
    </div>
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(340px,430px)_minmax(0,1fr)]">
      <div className="space-y-5">
        <section className={card}>
          <div className="mb-4 flex items-center gap-2"><Layers3 className="h-5 w-5 text-teal-700"/><h2 className="text-lg font-bold">1. Briefing da marca</h2></div>
          <div className="space-y-3">
            <label className="block text-sm font-medium">Empresa
              <select className={`mt-1 ${inputStyle}`} value={form.brandId} onChange={(e)=>set('brandId',e.target.value)}>
                {(brands.data??[]).map((b)=><option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <p className="text-xs text-slate-500">Configure logo, cores e informações em <a className="font-semibold underline" href="/admin">Marca e regras</a>.</p>
            {([
              ['name','Nome da campanha'], ['objective','Objetivo da campanha'], ['audience','Público-alvo'],
              ['keyMessage','Mensagem principal (informação conferida)'],['cta','Chamada para ação'], ['sourceNotes','Fonte dos dados / autorização'],
            ] as const).map(([key,title]) => <label className="block text-sm font-medium" key={key}>{title}
              {key==='objective'||key==='keyMessage'||key==='sourceNotes'
                ? <textarea className={`mt-1 ${inputStyle}`} rows={key==='sourceNotes'?3:2} value={form[key]} onChange={(e)=>set(key,e.target.value)}/>
                : <input className={`mt-1 ${inputStyle}`} value={form[key]} onChange={(e)=>set(key,e.target.value)} />}
            </label>)}
            <fieldset><legend className="text-sm font-medium">Formatos para exportar</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">{FORMATS.map((f)=><label key={f.id} className={`cursor-pointer rounded-lg border p-2 text-center text-xs ${form.formats.includes(f.id)?'border-teal-600 bg-teal-50 text-teal-900':'border-slate-200 text-slate-600'}`}>
                <input className="sr-only" type="checkbox" checked={form.formats.includes(f.id)} onChange={(e)=>set('formats',e.target.checked?[...form.formats,f.id]:form.formats.filter((x)=>x!==f.id))} />
                <div className="font-semibold">{f.title}</div><div className="mt-1 text-[10px]">{f.dimension}</div>
              </label>)}</div>
            </fieldset>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              <input type="checkbox" className="mt-1" checked={form.confirmed} onChange={(e)=>set('confirmed',e.target.checked)}/>
              Confirmo que as informações foram conferidas e estou autorizado(a) a utilizar os materiais da marca. A IA não é fonte oficial desses fatos.
            </label>
            <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-800 px-4 py-3 font-bold text-white shadow-sm hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50" disabled={!canCreate||!form.confirmed||create.isPending||form.formats.length===0} onClick={()=>create.mutate()}>
              <Sparkles className="h-4 w-4"/>{create.isPending?'Gerando...':'Criar campanha'}</button>
            {!canCreate && <p className="text-xs text-amber-700">Entre como criador ou administrador para criar.</p>}
          </div>
        </section>
        <section className={card}>
          <h2 className="mb-3 font-bold">Campanhas salvas</h2>
          {campaigns.isLoading&&<p className="text-sm text-slate-500">Carregando...</p>}
          {campaigns.error&&<p className="text-sm text-red-700">Erro ao carregar campanhas.</p>}
          {campaigns.data?.length===0&&<p className="text-sm text-slate-500">Nenhuma campanha institucional criada ainda.</p>}
          <div className="space-y-2">{campaigns.data?.map((c)=><button key={c.id} type="button" onClick={()=>{setSelectedId(c.id);setFormat(c.input.formats[0])}} className={`block w-full rounded-lg border px-3 py-3 text-left ${selectedId===c.id?'border-teal-600 bg-teal-50':'border-slate-200 hover:bg-slate-50'}`}>
            <span className="block text-sm font-semibold">{c.name}</span>
            <span className="block text-xs text-slate-500">{c.brand.name} · {c.status} · {c.aiMode}</span>
          </button>)}</div>
        </section>
      </div>
      <div className="space-y-5">
        {!active && <div className={`${card} py-20 text-center`}><ImageIcon className="mx-auto mb-4 h-12 w-12 text-slate-300"/><h2 className="text-lg font-bold">Sua campanha aparecerá aqui</h2><p className="mt-2 text-sm text-slate-500">Crie ou escolha uma campanha salva para visualizar as peças.</p></div>}
        {active && <>
          <section className={card}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-wide text-teal-700">2. Produção e prévia</p><h2 className="mt-1 text-xl font-bold">{active.name}</h2>
                <p className="mt-1 text-xs text-slate-500">Marca: {active.brand.name} · Geração: {active.aiMode.includes('ia-')&&!active.aiMode.includes('fallback')?'IA configurada':'Template com dados do briefing (sem IA)'} · Status: {active.status}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${active.status==='aprovada'?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-800'}`}>{active.status}</span>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">{FORMATS.filter((f)=>active.input.formats.includes(f.id)).map((f)=><button key={f.id} onClick={()=>setFormat(f.id)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${format===f.id?'bg-teal-800 text-white':'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{f.title} · {f.dimension}</button>)}</div>
            <div className="mt-4 flex justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-4">
              {preview.isLoading ? <p className="p-8 text-sm">Preparando visualização...</p> : svgSrc ? <img className="max-h-[630px] max-w-full rounded-md shadow-lg" src={svgSrc} alt={`Prévia de ${active.name}, formato ${format}`} /> : <p className="p-8 text-sm text-red-700">Não foi possível gerar a prévia.</p>}
            </div>
            <p className="mt-2 text-xs text-slate-500">Prévia gerada a partir dos textos atuais. Imagens PNG finais serão exportadas somente após aprovação.</p>
          </section>
          <section className={card}>
            <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-bold">3. Revisar e editar os textos</h2>
              {canCreate&&<button disabled={generate.isPending} onClick={()=>generate.mutate()} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-xs hover:bg-slate-50"><RefreshCw className="h-3 w-3"/> Regenerar</button>}
            </div>
            {copy && <div className="space-y-3">{([
              ['headline','Título'],['subtitle','Texto de apoio'],['cta','Chamada para ação'],['caption','Legenda do post'],
            ] as const).map(([key,title])=><label className="block text-sm font-medium" key={key}>{title}
              {key==='caption'||key==='subtitle'?<textarea className={`mt-1 ${inputStyle}`} rows={key==='caption'?5:3} value={copy[key]} disabled={!canCreate} onChange={(e)=>setCopy({...copy,[key]:e.target.value})}/>
                :<input className={`mt-1 ${inputStyle}`} value={copy[key]} disabled={!canCreate} onChange={(e)=>setCopy({...copy,[key]:e.target.value})}/>}</label>)}
              {canCreate&&<button disabled={edit.isPending} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={()=>edit.mutate()}>Salvar textos e atualizar prévia</button>}
            </div>}
          </section>
          <section className={card}>
            <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-teal-700"/><h2 className="font-bold">4. Aprovação e exportação</h2></div>
            <p className="mt-2 text-sm text-slate-600">Quem criou a campanha não pode aprová-la. Depois de qualquer edição ou regeneração, é necessária uma nova aprovação.</p>
            {active.reviewedBy&&<p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">Última revisão por {active.reviewedBy}: {active.reviewNote||active.status}</p>}
            {canReview&&<div className="mt-4 space-y-3"><label className="block text-xs font-semibold">Comentário da revisão
              <textarea className={`mt-1 ${inputStyle}`} rows={2} maxLength={500} value={note} onChange={(e)=>setNote(e.target.value)} /></label>
              <div className="flex flex-wrap gap-2"><button className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={review.isPending||active.createdBy===user?.id} onClick={()=>review.mutate('aprovada')}><CheckCircle2 className="h-4 w-4"/> Aprovar</button>
              <button className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50" disabled={review.isPending||active.createdBy===user?.id} onClick={()=>review.mutate('reprovada')}>Pedir ajustes</button></div>
              {active.createdBy===user?.id&&<p className="text-xs text-amber-700">Troque para um usuário revisor para evitar autoaprovação.</p>}
            </div>}
            <button disabled={active.status!=='aprovada'||exp.isPending} onClick={()=>exp.mutate()} className="mt-4 flex items-center gap-2 rounded-lg bg-teal-800 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"><Download className="h-4 w-4"/>{exp.isPending?'Exportando PNG...':'Baixar pacote de peças aprovadas'}</button>
            <p className="mt-2 text-xs text-slate-500">O ZIP inclui PNGs nos formatos escolhidos, legenda e manifesto com origem da informação e aprovação.</p>
            <div className="mt-5 border-t border-slate-100 pt-4"><h3 className="text-sm font-semibold">Histórico de alterações</h3>
              <ul className="mt-2 space-y-1">{audit.data?.map((event,index)=><li key={`${event.createdAt}-${index}`} className="text-xs text-slate-600">{new Date(event.createdAt).toLocaleString('pt-BR')} · {event.actorId} · {event.action}</li>)}</ul>
            </div>
          </section>
        </>}
      </div>
    </div>
  </PageShell>;
}
