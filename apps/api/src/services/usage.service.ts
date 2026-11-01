import { db } from '../db/client';
import { env, isDemo } from '../config/env';
import { HttpError } from '../utils/errors';
export async function usageStatus(){
 const day=new Date().toISOString().slice(0,10);
 const {rows}=await db().query<{kind:string;calls:number}>('select kind,calls from ai_daily_usage where day=$1',[day]);
 const used=(kind:string)=>Number(rows.find(r=>r.kind===kind)?.calls??0);
 return {day,resetAt:new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString(),freeOnly:env.freeOnly,
  images:{used:used('image'),limit:env.imageDailyLimit},text:{used:used('text'),limit:env.textDailyLimit},
  note:'Limites deste espaço de trabalho. O saldo compartilhado da conta é consultado no painel Cloudflare.'};
}
export async function reserveAICall(kind:'text'|'image'){
 if(isDemo())return;
 if(!env.freeOnly)throw new HttpError(403,'Este produto está configurado para operar apenas na camada gratuita.');
 const day=new Date().toISOString().slice(0,10);const limit=kind==='image'?env.imageDailyLimit:env.textDailyLimit;
 if(limit<=0)throw new HttpError(429,'A geração deste tipo está desativada no limite diário do espaço.');
 const {rows}=await db().query(`insert into ai_daily_usage(day,kind,calls) values($1,$2,1)
 on conflict(day,kind) do update set calls=ai_daily_usage.calls+1 where ai_daily_usage.calls<$3 returning calls`,[day,kind,limit]);
 if(!rows.length)throw new HttpError(429,'Limite diário local de IA atingido. Continue editando os materiais salvos e tente gerar novamente após a renovação.');
}
export function requireFreeTextProvider(){
 if(isDemo())return;
 if(!env.freeOnly || env.aiProvider!=='cloudflare')throw new HttpError(403,'Use a integração Cloudflare da camada gratuita. Outros provedores estão bloqueados neste produto.');
 if(!['@cf/meta/llama-3.1-8b-instruct-fp8','@cf/meta/llama-3.1-8b-instruct-fp8-fast'].includes(env.cloudflare.textModel))throw new HttpError(403,'Modelo de texto fora da lista habilitada para esta configuração gratuita.');
}
