import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { incidentsRouter } from './modules/incidents/incidents.routes.js';

function parseCorsOrigins(value: string) {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: parseCorsOrigins(env.CORS_ORIGIN) }));
  app.use(express.json({ limit: '1mb' }));
  app.use('/auth', authRouter);
  app.use('/incidents', incidentsRouter);
  app.use('/health', healthRouter);
  app.use((_req, res) => res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } }));
  app.use(errorHandler);
  return app;
}
