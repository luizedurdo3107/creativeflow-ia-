import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { HttpError } from '../utils/errors';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof MulterError) return res.status(400).json({error:err.code==='LIMIT_FILE_SIZE'?'O arquivo deve ter até 5 MB.':'Não foi possível receber o arquivo.'});
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Dados inválidos.', details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
  console.error(err);
  return res.status(500).json({ error: 'Erro inesperado no servidor.' });
}

/** Encapsula handlers async para que erros cheguem ao errorHandler. */
export const ah =
  <T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(fn: T) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);
