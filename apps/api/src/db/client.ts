import { mkdirSync,openSync,writeFileSync,readFileSync,closeSync,unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { env } from '../config/env';
import { SCHEMA_SQL } from './schema';

/**
 * Camada mínima de acesso a dados. Mesma interface para:
 *  - PGlite (Postgres em WebAssembly, arquivo local) — zero configuração na demo;
 *  - Postgres real (Azure Database for PostgreSQL, Neon, Supabase…) via DATABASE_URL.
 */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
  kind: 'pglite' | 'postgres' | 'memory';
}

let instance: Db | null = null;

export async function createDb(opts: { memory?: boolean;dataDir?:string;databaseUrl?:string } = {}): Promise<Db> {
  const databaseUrl=opts.databaseUrl??env.databaseUrl;
  if (!opts.memory && databaseUrl) {
    const pg = await import('pg');
    const pool = new pg.default.Pool({ connectionString: databaseUrl, ssl: databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined });
    const db: Db = {
      kind: 'postgres',
      query: async (sql, params) => {
        const r = await pool.query(sql, params as unknown[]);
        return { rows: r.rows };
      },
      exec: async (sql) => {
        await pool.query(sql);
      },
      close: () => pool.end(),
    };
    await db.exec(SCHEMA_SQL);
    return db;
  }
  const { PGlite } = await import('@electric-sql/pglite');
  let pglite: InstanceType<typeof PGlite>;
  let release=()=>{};
  if (opts.memory) pglite = new PGlite();
  else {
    const dataRoot=resolve(opts.dataDir??env.dataDir);mkdirSync(dataRoot,{recursive:true});
    const lock=resolve(dataRoot,'pglite.lock');
    try{const old=Number(readFileSync(lock,'utf8'));try{process.kill(old,0);throw new Error('Este banco já está aberto por outro processo. Encerre a outra instância antes de iniciar.');}catch(e){if((e as NodeJS.ErrnoException).code!=='ESRCH')throw e;}unlinkSync(lock);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
    const handle=openSync(lock,'wx',0o600);writeFileSync(handle,String(process.pid));closeSync(handle);
    release=()=>{try{if(readFileSync(lock,'utf8')===String(process.pid))unlinkSync(lock);}catch{}};
    const dir = resolve(dataRoot, 'pglite');
    mkdirSync(dir, { recursive: true });
    pglite = new PGlite(dir);
  }
  const db: Db = {
    kind: opts.memory ? 'memory' : 'pglite',
    query: async (sql, params) => {
      const r = await pglite.query(sql, params as unknown[]);
      return { rows: r.rows as never[] };
    },
    exec: async (sql) => {
      await pglite.exec(sql);
    },
    close: async () => {try{await pglite.close();}finally{release();}},
  };
  try{await db.exec(SCHEMA_SQL);return db;}catch(error){await db.close().catch(()=>{});throw error;}
}

export async function initDb(opts: { memory?: boolean;dataDir?:string;databaseUrl?:string } = {}): Promise<Db> {
  instance = await createDb(opts);
  return instance;
}

export function db(): Db {
  if (!instance) throw new Error('Banco não inicializado. Chame initDb() antes.');
  return instance;
}

export function setDb(d: Db) {
  instance = d;
}

export const json = (v: unknown) => JSON.stringify(v ?? null);
