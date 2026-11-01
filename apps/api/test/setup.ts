import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll } from 'vitest';

// Tests must never consume a real API quota or write into the team's database.
const dataDir = mkdtempSync(join(tmpdir(), 'creativeflow-test-'));
process.env.APP_MODE = 'demo';
process.env.AI_PROVIDER = 'mock';
process.env.DATA_DIR = dataDir;
process.env.DATABASE_URL = '';
process.env.CLOUDFLARE_ACCOUNT_ID = '';
process.env.CLOUDFLARE_API_TOKEN = '';
process.env.TEAMS_WEBHOOK_URL = '';
afterAll(() => rmSync(dataDir, {recursive:true,force:true}));
