import { Router } from 'express';
import { requireAdmin, requireAuth, requireIngestionKey } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { assignmentSchema, idParamSchema, ingestionSchema, listSchema, statusSchema } from './incidents.validation.js';
import { assignIncident, changeStatus, getIncident, ingestIncident, listAssignableUsers, listIncidents } from './incidents.service.js';

export const incidentsRouter = Router();

incidentsRouter.post(
  '/',
  requireIngestionKey,
  asyncHandler(async (req, res) => {
    const result = await ingestIncident(ingestionSchema.parse(req.body));
    res.status(result.statusCode).json({ data: result.incident });
  }),
);

incidentsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await listIncidents(listSchema.parse(req.query));
    res.json(result);
  }),
);

incidentsRouter.get('/assignable-users', requireAuth, requireAdmin, asyncHandler(async (_req, res) => {
  res.json({ data: await listAssignableUsers() });
}));

incidentsRouter.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json({ data: await getIncident(id) });
}));

incidentsRouter.patch('/:id/status', requireAuth, asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const body = statusSchema.parse(req.body);
  res.json({ data: await changeStatus(id, body.status, req.user!.id, body.version) });
}));

incidentsRouter.patch('/:id/assignment', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const body = assignmentSchema.parse(req.body);
  res.json({ data: await assignIncident(id, body.assignedTo, req.user!.id, body.version) });
}));
