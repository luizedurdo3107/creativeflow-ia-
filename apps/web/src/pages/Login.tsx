import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LockKeyhole, ArrowRight } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { DemoLoginPage } from './DemoLogin';
export function LoginPage(){
 const {config,loading,error,signIn}=useAuth();const nav=useNavigate();
 const [name,setName]=useState('');const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [failure,setFailure]=useState('');const [busy,setBusy]=useState(false);
 const [invitation]=useState(()=>new URLSearchParams(location.hash.slice(1)).get('convite')??'');
 if(config?.appMode==='demo')return <DemoLoginPage/>;
 const setup=!!config?.setupRequired&&!invitation;
 return <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-700 to-brand-600 px-5 py-10">
  <div className="w-full max-w-md"><div className="mb-7 text-center text-white"><img src="/favicon.svg" className="mx-auto mb-4 h-14 w-14" alt=""/><h1 className="text-3xl font-bold">CreativeFlow</h1><p className="mt-2 text-sm text-teal-100">Sua marca. Sua equipe. Campanhas prontas para aprovar.</p></div>
   <form className="rounded-2xl bg-white p-6 shadow-xl" onSubmit={async(e)=>{e.preventDefault();setFailure('');setBusy(true);try{await signIn(email,password,name,invitation);history.replaceState(null,'','/entrar');nav('/');}catch(err){setFailure((err as Error).message);}finally{setBusy(false);}}}>
    <LockKeyhole className="mb-3 h-6 w-6 text-teal-800"/><h2 className="text-xl font-bold">{invitation?'Definir sua senha':setup?'Crie seu espaço de trabalho':'Entre no seu espaço'}</h2>
    <p className="mb-5 mt-2 text-sm text-slate-600">{invitation?'Use o convite da sua equipe para criar ou recuperar seu acesso.':setup?'Cadastre o responsável. Depois, adicione sua marca e convide os integrantes da equipe.':'Use o e-mail e a senha cadastrados. Seus materiais ficam no espaço da equipe.'}</p>
    {setup&&<label className="mb-3 block text-sm font-medium">Seu nome<input required minLength={2} maxLength={100} autoComplete="name" className="input mt-1" value={name} onChange={e=>setName(e.target.value)}/></label>}
    {!invitation&&<label className="mb-3 block text-sm font-medium">E-mail<input required type="email" maxLength={254} autoComplete="username" className="input mt-1" value={email} onChange={e=>setEmail(e.target.value)}/></label>}
    <label className="block text-sm font-medium">{setup||invitation?'Crie uma senha':'Senha'}<input required type="password" minLength={setup||invitation?15:1} maxLength={128} autoComplete={setup||invitation?'new-password':'current-password'} className="input mt-1" value={password} onChange={e=>setPassword(e.target.value)}/></label>
    {(setup||invitation)&&<p className="mt-2 text-xs text-slate-500">Use uma frase com pelo menos 15 caracteres.</p>}
    {(failure||error)&&<p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{failure||error}</p>}
    <button type="submit" disabled={busy||loading||!config} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-teal-800 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy?'Aguarde...':invitation?'Salvar senha e entrar':setup?'Criar meu espaço':'Entrar'}<ArrowRight className="h-4 w-4"/></button>
    {!setup&&!invitation&&<p className="mt-4 text-xs text-slate-500">Esqueceu a senha? Peça ao administrador da equipe um link de recuperação de acesso.</p>}
   </form><p className="mt-5 text-center text-xs text-teal-100">Contas reais, permissões por perfil e revisão humana.</p>
  </div>
 </main>;
}
