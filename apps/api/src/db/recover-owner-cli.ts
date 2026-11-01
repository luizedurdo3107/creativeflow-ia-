import { createInterface } from 'node:readline/promises';
import { z } from 'zod';
import { initDb } from './client';
import { hashPassword } from '../services/accounts.service';
import { isDemo } from '../config/env';
import { audit } from '../models/governance.model';
function hidden(prompt:string):Promise<string>{
 if(!process.stdin.isTTY)throw new Error('Execute em um terminal interativo. A senha não pode ser passada por argumento.');
 process.stdout.write(prompt);process.stdin.setRawMode(true);process.stdin.setEncoding('utf8');process.stdin.resume();
 return new Promise((resolve,reject)=>{let value='';const done=(cancel=false)=>{process.stdin.removeListener('data',read);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');cancel?reject(new Error('Operação cancelada.')):resolve(value);};const read=(data:string)=>{for(const ch of data){if(ch==='\r'||ch==='\n'){done();return;}if(ch==='\u0003'){done(true);return;}if(ch==='\u007f')value=Array.from(value).slice(0,-1).join('');else value+=ch;}};process.stdin.on('data',read);});
}
if(isDemo())throw new Error('A recuperação do proprietário é usada no modo produto.');
let database:Awaited<ReturnType<typeof initDb>>|undefined;
try{
 const rl=createInterface({input:process.stdin,output:process.stdout});const email=(await rl.question('E-mail do proprietário: ')).trim().toLowerCase();rl.close();
 const next=z.string().min(15,'Use pelo menos 15 caracteres.').max(128).parse(await hidden('Nova senha (não será exibida): '));
 if(next!==await hidden('Confirme a nova senha: '))throw new Error('As senhas não coincidem.');
 database=await initDb();
 const {rows}=await database.query<{id:string}>('select u.id from users u join workspace_bootstrap b on b.owner_id=u.id where lower(u.email)=$1',[email]);
 if(!rows.length)throw new Error('Proprietário não encontrado neste banco.');
 await database.query('update users set password_hash=$2,active=true where id=$1',[rows[0].id,await hashPassword(next)]);
 await database.query('delete from auth_sessions where user_id=$1',[rows[0].id]);
 await audit({actorId:rows[0].id,type:'owner.recovered_locally'});console.log('Acesso restaurado. Reinicie o servidor e entre com sua nova senha.');
}catch(error){console.error((error as Error).message);process.exitCode=1;}finally{await database?.close();}
