import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { prisma } from '../../shared/prisma.js';

export const healthRouter = Router();

healthRouter.get('/live', (_req, res) => res.json({ data: { ok: true } }));

healthRouter.get('/ready', asyncHandler(async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ data: { ok: true } });
}));

healthRouter.get('/worker', requireAuth, asyncHandler(async (_req, res) => {
  const heartbeat = await prisma.workerHeartbeat.findUnique({ where: { name: 'escalation' } });
  res.json({ data: { heartbeat } });
}));
