import { readFile } from 'node:fs/promises';
import { restoreWorkspace } from '../services/backup.service';
const [backup,target]=process.argv.slice(2);
if(!backup||!target){console.error('Uso: pnpm restore:workspace /caminho/backup.zip /nova/pasta/de/dados');process.exit(1);}
try{const result=await restoreWorkspace(await readFile(backup),target);console.log(`Restaurado em ${result.destination}: ${result.campaigns} campanhas. Aponte DATA_DIR para esta pasta e reinicie. Sessões anteriores não foram restauradas.`);}catch(error){console.error((error as Error).message);process.exit(1);}
