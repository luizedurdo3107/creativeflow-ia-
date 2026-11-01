import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { db } from '../db/client';
import { env, isDemo } from '../config/env';
import { newId } from '../utils/id';
import { HttpError } from '../utils/errors';
import { getUser, listUsers, type UserRow } from '../models/user.model';
import { audit } from '../models/governance.model';

const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const cookieName='cf_session';
const password=z.string().min(15,'Use uma senha com pelo menos 15 caracteres.').max(128);
const email=z.string().trim().email().max(254).transform(s=>s.toLowerCase());
const account=z.object({name:z.string().trim().min(2).max(100),email,password});
const COOKIE={httpOnly:true,sameSite:'strict' as const,path:'/api'};
const derive=(value:string,salt:string)=>new Promise<Buffer>((resolve,reject)=>scrypt(value,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024},(error,key)=>error?reject(error):resolve(key)));
export async function hashPassword(value:string){const salt=randomBytes(24).toString('hex');return `scrypt-v1$${salt}$${(await derive(value,salt)).toString('hex')}`;}
async function matchesPassword(value:string,stored?:string|null){
 const parts=(stored??'scrypt-v1$0123456789abcdef0123456789abcdef$'+'00'.repeat(64)).split('$');
 if(parts.length!==3||parts[0]!=='scrypt-v1')return false;
 const actual=await derive(value,parts[1]);const expected=Buffer.from(parts[2],'hex');
 return expected.length===actual.length&&timingSafeEqual(actual,expected)&&!!stored;
}
export function sessionToken(req:Request){
 const entry=(req.headers.cookie??'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='));
 const token=entry?.slice(cookieName.length+1)??'';
 return /^[a-f0-9]{64}$/.test(token)?token:'';
}
export async function userForSession(token:string):Promise<UserRow>{
 const {rows}=await db().query<{user_id:string}>('select user_id from auth_sessions where token_hash=$1 and expires_at>now()',[hash(token)]);
 const user=rows[0]?await getUser(rows[0].user_id):undefined;
 if(!user||!(await db().query('select id from users where id=$1 and active=true and password_hash is not null',[user.id])).rows.length)throw new HttpError(401,'Entre com seu e-mail e senha para continuar.');
 return user;
}
async function session(user:UserRow,res:Response){
 const token=randomBytes(32).toString('hex');
 await db().query('delete from auth_sessions where expires_at<now()');
 await db().query("insert into auth_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '12 hours')",[hash(token),user.id]);
 res.cookie(cookieName,token,{...COOKIE,secure:env.cookieSecure,maxAge:12*3600_000});
 return {user};
}
export async function authConfig(){
 const {rows}=await db().query('select id from workspace_bootstrap where id=1');
 return {appMode:env.appMode,setupRequired:!isDemo()&&rows.length===0,freeOnly:env.freeOnly};
}
export async function setupAccount(raw:unknown,res:Response){
 if(isDemo())throw new HttpError(404,'Configuração de conta indisponível na demonstração.');
 const input=account.parse(raw);const id=newId('user');const pass=await hashPassword(input.password);
 const {rows}=await db().query(`with claim as (insert into workspace_bootstrap(id,owner_id) values(1,$1) on conflict do nothing returning id)
 insert into users(id,name,email,role,password_hash) select $1,$2,$3,'admin',$4 from claim returning id,name,email,role`,[id,input.name,input.email,pass]);
 if(!rows.length)throw new HttpError(409,'O espaço de trabalho já foi configurado. Entre com sua conta.');
 const user=rows[0] as unknown as UserRow;
 await audit({actorId:id,type:'workspace.created'});
 return session(user,res);
}
const attempts=new Map<string,{count:number;until:number}>();
export function rateLimitAuth(key:string){
 const now=Date.now();
 for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);
 if(attempts.size>=10000&&!attempts.has(key))throw new HttpError(429,'Muitas tentativas. Aguarde alguns minutos.');
 const entry=attempts.get(key)??{count:0,until:now+15*60_000};
 entry.count++;attempts.set(key,entry);
 if(entry.count>20)throw new HttpError(429,'Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.');
}
export async function passwordLogin(raw:unknown,res:Response){
 const input=z.object({email,password:z.string().min(1).max(128)}).parse(raw);
 rateLimitAuth('email:'+input.email);
 const {rows}=await db().query<{id:string;password_hash:string;active:boolean}>('select id,password_hash,active from users where lower(email)=$1',[input.email]);
 const match=await matchesPassword(input.password,rows[0]?.password_hash);
 if(!match||!rows[0]?.active)throw new HttpError(401,'E-mail ou senha incorretos.');
 return session((await getUser(rows[0].id))!,res);
}
export async function logoutAccount(req:Request,res:Response){
 const token=sessionToken(req);if(token)await db().query('delete from auth_sessions where token_hash=$1',[hash(token)]);
 res.clearCookie(cookieName,{...COOKIE,secure:env.cookieSecure});
 return {ok:true};
}
export async function changePassword(raw:unknown,userId:string,res:Response){
 const input=z.object({currentPassword:z.string().min(1).max(128),newPassword:password}).parse(raw);
 const {rows}=await db().query<{password_hash:string}>('select password_hash from users where id=$1',[userId]);
 if(!await matchesPassword(input.currentPassword,rows[0]?.password_hash))throw new HttpError(401,'Senha atual incorreta.');
 await db().query('update users set password_hash=$2 where id=$1',[userId,await hashPassword(input.newPassword)]);
 await db().query('delete from auth_sessions where user_id=$1',[userId]);
 await audit({actorId:userId,type:'account.password_changed'});
 return session((await getUser(userId))!,res);
}
export async function teamMembers(){
 const {rows}=await db().query('select u.id,u.name,u.email,u.role,u.active,(u.id=b.owner_id) as owner from users u cross join workspace_bootstrap b where u.password_hash is not null order by u.name');
 return rows;
}
export async function inviteMember(raw:unknown,by:string){
 const input=z.object({name:z.string().trim().min(2).max(100),email,role:z.enum(['criador','revisor','admin']),reset:z.boolean().default(false)}).parse(raw);
 const {rows}=await db().query('select id from users where lower(email)=$1',[input.email]);
 if(rows.length&&!input.reset)throw new HttpError(409,'Este e-mail já está cadastrado. Use a recuperação de acesso.');
 if(!rows.length&&input.reset)throw new HttpError(404,'Conta não encontrada.');
 await db().query('update team_invitations set used_at=now() where email=$1 and used_at is null',[input.email]);
 const token=randomBytes(32).toString('hex');const id=newId('invite');
 await db().query("insert into team_invitations(id,token_hash,email,name,role,created_by,expires_at,purpose) values($1,$2,$3,$4,$5,$6,now()+interval '48 hours',$7)",[id,hash(token),input.email,input.name,input.role,by,input.reset?'reset':'invite']);
 await audit({actorId:by,type:input.reset?'account.recovery_created':'team.invited',payload:{email:input.email,role:input.role}});
 return {url:env.appPublicUrl.replace(/\/$/,'')+'/entrar#convite='+token,expiresInHours:48};
}
export async function acceptInvitation(raw:unknown,res:Response){
 const input=z.object({token:z.string().regex(/^[a-f0-9]{64}$/),password}).parse(raw);
 const {rows:invitations}=await db().query<{email:string;purpose:string}>('select email,purpose from team_invitations where token_hash=$1 and used_at is null and expires_at>now()',[hash(input.token)]);
 if(!invitations.length)throw new HttpError(400,'Convite inválido ou expirado. Solicite um novo link ao administrador.');
 const pass=await hashPassword(input.password);
 const query=invitations[0].purpose==='reset'
 ? `with claim as(update team_invitations set used_at=now() where token_hash=$1 and used_at is null and expires_at>now() returning email), revoked as(delete from auth_sessions where user_id in(select u.id from users u join claim c on lower(u.email)=c.email)) update users set password_hash=$2 from claim where lower(users.email)=claim.email returning users.id,users.name,users.email,users.role`
 : `with claim as(update team_invitations set used_at=now() where token_hash=$1 and used_at is null and expires_at>now() returning email,name,role) insert into users(id,name,email,role,password_hash) select $3,name,email,role,$2 from claim returning id,name,email,role`;
 const {rows}=await db().query(query,[hash(input.token),pass,...(invitations[0].purpose==='reset'?[]:[newId('user')])]);
 if(!rows.length)throw new HttpError(400,'Este convite já foi utilizado.');
 await audit({actorId:rows[0].id as string,type:invitations[0].purpose==='reset'?'account.recovered':'team.joined'});
 return session(rows[0] as unknown as UserRow,res);
}
export async function updateMember(id:string,raw:unknown,by:string){
 const input=z.object({role:z.enum(['criador','revisor','admin']),active:z.boolean()}).parse(raw);
 if(id===by)throw new HttpError(400,'Altere outro integrante; sua própria permissão é preservada.');
 const {rows}=await db().query('update users set role=$2,active=$3 where id=$1 and id not in(select owner_id from workspace_bootstrap) and password_hash is not null returning id',[id,input.role,input.active]);
 if(!rows.length)throw new HttpError(400,'O proprietário do espaço mantém acesso de administração.');
 await db().query('delete from auth_sessions where user_id=$1',[id]);
 await audit({actorId:by,type:'team.permissions_changed',payload:{userId:id,...input}});
 return {ok:true};
}
