import JSZip from 'jszip';
import { mkdir,readFile,writeFile,readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { db, createDb } from '../db/client';
import { env } from '../config/env';
import { HttpError } from '../utils/errors';
const TABLES=['users','workspace_bootstrap','settings','institutional_campaigns','institutional_campaign_events','ai_daily_usage','audit_events'] as const;
const FILE=/^inst_[a-zA-Z0-9_-]+-(feed|portrait|story|banner)-[a-f0-9]{24}\.(png|jpg)$/;
const Manifest=z.object({format:z.literal('creativeflow-workspace-v1'),createdAt:z.string(),tables:z.record(z.array(z.record(z.unknown())))});
export async function backupWorkspace(){
 const fields=TABLES.map(name=>`'${name}',coalesce((select jsonb_agg(row_to_json(t)) from ${name} t),'[]'::jsonb)`).join(',');
 const {rows}=await db().query<{data:Record<string,Record<string,unknown>[]>}>(`select jsonb_build_object(${fields}) as data`);
 const tables=rows[0].data;const zip=new JSZip();
 zip.file('workspace.json',JSON.stringify({format:'creativeflow-workspace-v1',createdAt:new Date().toISOString(),tables}));
 const files=new Set<string>();
 for(const c of tables.institutional_campaigns??[])for(const meta of Object.values(c.artworks as Record<string,{filename:string}>??{})){if(!FILE.test(meta.filename))throw new HttpError(409,'Uma campanha contém referência de imagem inválida.');files.add(meta.filename);}
 for(const file of files){try{zip.file('ai-artworks/'+file,await readFile(resolve(env.dataDir,'ai-artworks',file)));}catch{throw new HttpError(409,'Uma imagem está ausente. Restaure o armazenamento antes de criar o backup.');}}
 zip.file('LEIA-ME.txt','Backup privado do CreativeFlow. Inclui cadastros, senhas protegidas por hash, campanhas, histórico e imagens. Não inclui credenciais Cloudflare nem sessões. Restaure com pnpm restore:workspace em uma nova pasta de dados.');
 return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}});
}
/** Offline restore always targets a new directory and revokes old sessions. */
export async function restoreWorkspace(buffer:Buffer,target:string){
 const destination=resolve(target);
 if(destination===resolve(env.dataDir))throw new Error('Escolha uma nova pasta, diferente do banco em uso.');
 try{if((await readdir(destination)).length)throw new Error('A pasta de destino precisa estar vazia.');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 if(buffer.length>200*1024*1024)throw new Error('Backup maior que 200 MB.');
 const zip=await JSZip.loadAsync(buffer);const files=Object.values(zip.files);
 if(files.length>10000)throw new Error('Backup com quantidade excessiva de arquivos.');
 let total=0;for(const file of files){const size=Number((file as unknown as {_data?:{uncompressedSize?:number}})._data?.uncompressedSize??0);total+=size;if(size>50*1024*1024||total>500*1024*1024)throw new Error('Backup excede os limites de restauração.');}
 const content=zip.file('workspace.json');if(!content)throw new Error('Manifesto do espaço não encontrado.');
 const manifest=Manifest.parse(JSON.parse(await content.async('string')));
 for(const name of TABLES)if(!manifest.tables[name])throw new Error('Backup incompleto: '+name);
 const database=await createDb({dataDir:destination,databaseUrl:''});
 try{
  await database.exec('begin');
  for(const name of TABLES)if(manifest.tables[name].length)await database.query(`insert into ${name} select * from jsonb_populate_recordset(null::${name},$1::jsonb)`,[JSON.stringify(manifest.tables[name])]);
  await mkdir(resolve(destination,'ai-artworks'),{recursive:true});
  for(const c of manifest.tables.institutional_campaigns)for(const meta of Object.values(c.artworks as Record<string,{filename:string}>??{})){
   if(!FILE.test(meta.filename))throw new Error('Nome de imagem inválido no backup.');
   const image=zip.file('ai-artworks/'+meta.filename);if(!image)throw new Error('Imagem ausente no backup.');
   await writeFile(resolve(destination,'ai-artworks',meta.filename),await image.async('nodebuffer'),{mode:0o600});
  }
  await database.exec('commit');return {destination,campaigns:manifest.tables.institutional_campaigns.length};
 }catch(error){await database.exec('rollback').catch(()=>{});throw error;}finally{await database.close();}
}
