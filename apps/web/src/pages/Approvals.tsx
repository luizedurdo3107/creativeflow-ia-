import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../lib/auth';
import { PageShell } from '../components/Layout';
import { DemoApprovalsPage } from './DemoApprovals';
export function ApprovalsPage(){const {config}=useAuth();return config?.appMode==='demo'?<DemoApprovalsPage/>:<ProductApprovals/>;}
function ProductApprovals(){const q=useQuery({queryKey:['institutional'],queryFn:api.institutional});const {user}=useAuth();const items=(q.data??[]).filter(c=>c.status==='em_revisao');return <PageShell><h1 className="text-3xl font-bold">Revisões da equipe</h1><p className="mt-2 text-sm text-slate-600">Confira marca, fontes, textos e formatos. Quem criou ou fez a última edição não pode aprovar.</p>{q.error&&<p role="alert" className="mt-5 text-red-700">{q.error.message}</p>}<div className="mt-6 space-y-3">{q.isLoading?<p>Carregando...</p>:items.length===0?<div className="card p-8 text-sm text-slate-600">Nenhuma campanha enviada para revisão.</div>:items.map(c=><Link className="card block p-5 hover:border-teal-500" to={`/marcas/campanhas?campanha=${c.id}`} key={c.id}><h2 className="font-bold">{c.name}</h2><p className="mt-1 text-sm text-slate-600">{c.brand.name} · {c.input.formats.length} formatos · Versão {c.revision}</p><p className="mt-2 text-xs text-teal-800">{c.createdBy===user?.id||c.lastEditedBy===user?.id?'Aguardando outro revisor da equipe':'Abrir campanha para conferir'}</p></Link>)}</div></PageShell>;}
