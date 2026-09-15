import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const ingestionSchema = z.object({
  source: z.string().trim().min(1).max(120),
  type: z.string().trim().min(1).max(120),
  severity: z.enum(['low', 'medium', 'high']),
  message: z.string().trim().min(1).max(2000),
  timestamp: z.coerce.date(),
  eventId: z.string().trim().min(1).max(200).optional(),
});

export const listSchema = z.object({
  status: z.enum(['open', 'escalated', 'acknowledged', 'resolved']).optional(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
  source: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const statusSchema = z.object({
  status: z.enum(['acknowledged', 'resolved']),
  version: z.number().int().positive().optional(),
});

export const assignmentSchema = z.object({
  assignedTo: z.string().uuid().nullable(),
  version: z.number().int().positive().optional(),
});
