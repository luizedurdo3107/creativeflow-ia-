import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { env, isDemo } from './config/env';
import { errorHandler } from './middleware/error';
import { apiRouter } from './routes';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');if(env.nodeEnv==='production')res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");next();});
  app.use('/api',(req,res,next)=>{
    res.setHeader('Cache-Control','no-store');
    if(!isDemo()&&!['GET','HEAD','OPTIONS'].includes(req.method)){
      const origin=req.headers.origin;
      if(req.headers['x-cf-client']!=='creativeflow-web'||(origin&&origin!==env.appPublicUrl&&origin!==`${req.protocol}://${req.get('host')}`))return res.status(403).json({error:'Origem da solicitação inválida. Atualize a página.'});
    }
    next();
  });
  app.use(express.json({ limit: '2mb' }));
  app.use('/api', apiRouter());
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
  app.use(errorHandler);

  // Em produção a API também serve o front-end buildado (um único container).
  if (existsSync(env.webDist)) {
    app.use(express.static(env.webDist, { maxAge: '1h', index: false }));
    app.get('*', (_req, res) => res.sendFile(join(env.webDist, 'index.html')));
  }
  return app;
}
