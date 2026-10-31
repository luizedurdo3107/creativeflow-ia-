import { z } from 'zod';
import { getSetting, setSetting } from '../models/governance.model';

/** Cadastro independente do manual farmacêutico atual; sem alterar regras comerciais. */
export const BrandProfileSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(10).max(1500),
  website: z.string().url().max(300).optional().or(z.literal('')),
  logoUrl: z.string().url().max(500).optional().or(z.literal('')),
  logoDataUri: z.string().max(1_700_000).regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/).optional().or(z.literal('')),
  colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).min(1).max(8),
  tone: z.string().trim().min(3).max(300),
  guidelines: z.string().max(3000).default(''),
});
export type BrandProfile = z.infer<typeof BrandProfileSchema>;

const LUMOS: BrandProfile = {
  id: 'lumos-connect', name: 'Lumos Connect',
  description: 'Startup de tecnologia educacional responsável pelo Norya, plataforma de aprendizagem inclusiva.',
  website: '', logoUrl: '', colors: ['#09252D', '#4E6F5A', '#F5F3EC'],
  tone: 'Clara, acessível, profissional e acolhedora',
  guidelines: 'Exemplo inicial: verificar identidade, logos e informações com a equipe antes da publicação. Não inventar resultados ou parcerias.',
};

export async function listBrandProfiles(): Promise<BrandProfile[]> {
  const saved = await getSetting<unknown>('brandProfiles');
  if (saved === undefined) return [LUMOS];
  return z.array(BrandProfileSchema).parse(saved);
}

export async function upsertBrandProfile(input: unknown): Promise<BrandProfile> {
  const brand = BrandProfileSchema.parse(input);
  const current = await listBrandProfiles();
  await setSetting('brandProfiles', [...current.filter((p) => p.id !== brand.id), brand]);
  return brand;
}
