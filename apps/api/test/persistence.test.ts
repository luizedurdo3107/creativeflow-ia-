import { describe, it, expect } from 'vitest';
import { createDb, setDb } from '../src/db/client';
import { seedDatabase } from '../src/db/seed';
import { listBrandProfiles, upsertBrandProfile } from '../src/services/brand-profiles.service';
import { createInstitutional, getInstitutional, reviewInstitutional, updateInstitutionalCopy } from '../src/services/institutional.service';

describe('persistência em disco após reinício',()=>{
 it('preserva a marca, os textos e a revisão sem recarregar dados fictícios',async()=>{
  const first=await createDb();setDb(first);await seedDatabase();
  await upsertBrandProfile({id:'marca-real',name:'Marca Cadastrada',description:'Informação fornecida pela própria empresa.',colors:['#152637','#abcdef'],tone:'Informativo',fontFamily:'Poppins',guidelines:'Somente fatos conferidos'});
  const campaign=await createInstitutional({brandId:'marca-real',name:'Campanha persistente',objective:'Apresentar a marca e os serviços cadastrados.',audience:'Comunidade local',keyMessage:'A empresa apresenta seus serviços à comunidade.',cta:'Conheça a empresa',sourceNotes:'Dados informados e confirmados pelo responsável.',formats:['feed'],confirmed:true},'u-ana');
  await updateInstitutionalCopy(campaign.id,{headline:'Título revisado'},'u-ana');
  await reviewInstitutional(campaign.id,'aprovada','u-rui','Conteúdo conferido');
  await first.close();
  const second=await createDb();setDb(second);
  try{
   const restored=await getInstitutional(campaign.id);
   expect(restored.copies.headline).toBe('Título revisado');expect(restored.status).toBe('aprovada');expect(restored.revision).toBe(3);expect(restored.brand.fontFamily).toBe('Poppins');
   expect((await listBrandProfiles()).find(b=>b.id==='marca-real')?.colors).toEqual(['#152637','#abcdef']);
  }finally{await second.close();}
 },60000);
});
