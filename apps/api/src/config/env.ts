import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = resolve(here, '../../../..');
export const API_DIR = resolve(here, '../..');

for (const p of [resolve(ROOT_DIR, '.env'), resolve(API_DIR, '.env')]) if (existsSync(p)) config({ path: p });

/** Ignore copied placeholders when reporting provider configuration. */
export const credentialProvided = (value:string) => Boolean(value.trim()) && !/^(?:COLE[_ ]|COLOQUE[_ ]|seu[_ ]|sua[_ ]|your[_ ]|<|changeme|change-me)/i.test(value.trim());

const str = (k: string, d = '') => (process.env[k] ?? d).trim();

const appMode = str('APP_MODE','product') === 'demo' ? 'demo' : 'product';
export const env = {
  appMode,
  freeOnly: str('FREE_ONLY','true') !== 'false',
  imageDailyLimit: Math.min(10,Math.max(0,Number(str('IMAGE_DAILY_LIMIT','10'))||0)),
  textDailyLimit: Math.min(20,Math.max(0,Number(str('TEXT_DAILY_LIMIT','20'))||0)),
  allowRemoteSetup:str('ALLOW_REMOTE_SETUP','false')==='true',
  cookieSecure: str('COOKIE_SECURE','false') === 'true',
  nodeEnv: str('NODE_ENV', 'development'),
  host:str('API_HOST','127.0.0.1'),
  port: Number(str('PORT', '3001')),
  databaseUrl: str('DATABASE_URL'),
  dataDir: str('DATA_DIR', resolve(ROOT_DIR, appMode==='product'?'data/product':'data')),
  jwtSecret: str('JWT_SECRET', 'dev-secret-troque'),
  /** Tempo máximo de espera por resposta da IA (ms). Modelos que "pensam" podem levar mais de 1 minuto. */
  aiTimeoutMs: Number(str('AI_TIMEOUT_MS', '120000')),
  aiProvider: str('AI_PROVIDER', 'mock') as 'mock' | 'openai' | 'cloudflare' | 'azure-openai' | 'anthropic',
  openai: {
    key: str('OPENAI_API_KEY'),
    model: str('OPENAI_MODEL', 'gpt-4o-mini'),
    /** Modelos reserva, separados por vírgula, usados quando o principal está sobrecarregado (503/429). */
    fallbackModels: str('OPENAI_FALLBACK_MODELS').split(',').map((m) => m.trim()).filter(Boolean),
    baseUrl: str('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
  },
  cloudflare: {
    accountId: str('CLOUDFLARE_ACCOUNT_ID'),
    token: str('CLOUDFLARE_API_TOKEN'),
    textModel: str('CLOUDFLARE_TEXT_MODEL', '@cf/meta/llama-3.1-8b-instruct-fp8'),
  },
  azure: {
    endpoint: str('AZURE_OPENAI_ENDPOINT'),
    key: str('AZURE_OPENAI_API_KEY'),
    deployment: str('AZURE_OPENAI_DEPLOYMENT'),
    apiVersion: str('AZURE_OPENAI_API_VERSION', '2024-10-21'),
  },
  anthropic: { key: str('ANTHROPIC_API_KEY'), model: str('ANTHROPIC_MODEL', 'claude-sonnet-4-5') },
  image: {
    enabled: str('IMAGE_AI_ENABLED', 'true') === 'true',
    generationSecret: str('IMAGE_GENERATION_SECRET'),
    model: '@cf/black-forest-labs/flux-1-schnell',
    quality: str('OPENAI_IMAGE_QUALITY', 'medium') as 'low' | 'medium' | 'high',
    timeoutMs: Number(str('IMAGE_TIMEOUT_MS', '180000')),
  },
  teamsWebhookUrl: str('TEAMS_WEBHOOK_URL'),
  appPublicUrl: str('APP_PUBLIC_URL', 'http://localhost:5173'),
  chromiumPath: str('CHROMIUM_PATH'),
  webDist: resolve(ROOT_DIR, 'apps/web/dist'),
};

export const isProd = env.nodeEnv === 'production';

export const isDemo = () => env.appMode === 'demo';
