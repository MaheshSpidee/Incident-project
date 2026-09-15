import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../shared/errors.js';

export type AuthUser = { id: string; email: string; role: 'operator' | 'admin' };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser) {
  return jwt.sign(user, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) throw new AppError(401, 'unauthorized', 'Missing bearer token');
  try {
    req.user = jwt.verify(header.slice(7), env.JWT_SECRET) as AuthUser;
    next();
  } catch {
    throw new AppError(401, 'unauthorized', 'Invalid or expired token');
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') throw new AppError(403, 'forbidden', 'Admin role required');
  next();
}

export function requireIngestionKey(req: Request, _res: Response, next: NextFunction) {
  if (req.header('x-ingestion-api-key') !== env.INGESTION_API_KEY) {
    throw new AppError(401, 'unauthorized', 'Invalid ingestion credential');
  }
  next();
}
