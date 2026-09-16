import type { IncidentStatus, Prisma } from '@prisma/client';
import { Prisma as PrismaNs } from '@prisma/client';
import { env } from '../../config/env.js';
import { AppError, notFound } from '../../shared/errors.js';
import { prisma } from '../../shared/prisma.js';

const includeDetails = {
  assignee: { select: { id: true, email: true, role: true } },
  history: { orderBy: { createdAt: 'asc' as const } },
};

function publicIncident(incident: any) {
  return incident;
}

function equivalent(a: any, b: any) {
  return (
    a.source === b.source &&
    a.type === b.type &&
    a.severity === b.severity &&
    a.message === b.message &&
    new Date(a.occurredAt).getTime() === b.timestamp.getTime()
  );
}

export async function ingestIncident(input: {
  source: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  timestamp: Date;
  eventId?: string;
}) {
  const receivedAt = new Date();
  const escalationDueAt =
    input.severity === 'high'
      ? new Date(receivedAt.getTime() + env.ESCALATION_THRESHOLD_SECONDS * 1000)
      : null;
  try {
    const incident = await prisma.incident.create({
      data: {
        eventId: input.eventId,
        source: input.source,
        type: input.type,
        severity: input.severity,
        message: input.message,
        occurredAt: input.timestamp,
        receivedAt,
        escalationDueAt,
        history: {
          create: { actorType: 'device', action: 'created', toStatus: 'open' },
        },
      },
      include: includeDetails,
    });
    return { statusCode: 201, incident: publicIncident(incident) };
  } catch (err) {
    if (err instanceof PrismaNs.PrismaClientKnownRequestError && err.code === 'P2002' && input.eventId) {
      const existing = await prisma.incident.findUnique({
        where: { source_eventId: { source: input.source, eventId: input.eventId } },
        include: includeDetails,
      });
      if (existing && equivalent(existing, input)) return { statusCode: 200, incident: publicIncident(existing) };
      throw new AppError(409, 'duplicate_event_conflict', 'Event identity already exists with different content');
    }
    throw err;
  }
}

export async function listIncidents(query: {
  status?: IncidentStatus;
  severity?: 'low' | 'medium' | 'high';
  source?: string;
  page: number;
  limit: number;
}) {
  const where: Prisma.IncidentWhereInput = {
    status: query.status,
    severity: query.severity,
    source: query.source ? { contains: query.source, mode: 'insensitive' } : undefined,
  };
  const [total, items] = await prisma.$transaction([
    prisma.incident.count({ where }),
    prisma.incident.findMany({
      where,
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: { assignee: { select: { id: true, email: true, role: true } } },
    }),
  ]);
  return {
    data: items,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
}

export async function getIncident(id: string) {
  const incident = await prisma.incident.findUnique({ where: { id }, include: includeDetails });
  if (!incident) throw notFound('Incident not found');
  return incident;
}

function assertTransition(from: IncidentStatus, to: IncidentStatus) {
  const allowed = (from === 'open' && to === 'acknowledged') || (from === 'escalated' && to === 'acknowledged') || (from === 'acknowledged' && to === 'resolved');
  if (!allowed) throw new AppError(409, 'invalid_transition', `Cannot transition from ${from} to ${to}`);
}

async function lockIncident(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "Incident"
    WHERE "id" = ${id}::uuid
    FOR UPDATE
  `;
  if (rows.length === 0) throw notFound('Incident not found');
}

export async function changeStatus(id: string, toStatus: 'acknowledged' | 'resolved', actorId: string, version?: number) {
  return prisma.$transaction(async (tx) => {
    await lockIncident(tx, id);
    const current = await tx.incident.findUnique({ where: { id } });
    if (!current) throw notFound('Incident not found');
    if (version && current.version !== version) throw new AppError(409, 'stale_incident', 'Incident has changed; refresh and retry');
    assertTransition(current.status, toStatus);
    const data: Prisma.IncidentUpdateInput = {
      status: toStatus,
      version: { increment: 1 },
      acknowledgedAt: toStatus === 'acknowledged' ? new Date() : current.acknowledgedAt,
      resolvedAt: toStatus === 'resolved' ? new Date() : current.resolvedAt,
    };
    await tx.incident.update({ where: { id }, data });
    await tx.incidentHistory.create({
      data: { incidentId: id, fromStatus: current.status, toStatus, actorId, actorType: 'user', action: toStatus },
    });
    return tx.incident.findUniqueOrThrow({ where: { id }, include: includeDetails });
  });
}

export async function assignIncident(id: string, assignedTo: string | null, actorId: string, version?: number) {
  return prisma.$transaction(async (tx) => {
    await lockIncident(tx, id);
    const current = await tx.incident.findUnique({ where: { id } });
    if (!current) throw notFound('Incident not found');
    if (version && current.version !== version) throw new AppError(409, 'stale_incident', 'Incident has changed; refresh and retry');
    if (assignedTo) {
      const user = await tx.user.findUnique({ where: { id: assignedTo } });
      if (!user) throw new AppError(400, 'invalid_assignee', 'Assigned user does not exist');
    }
    await tx.incident.update({
      where: { id },
      data: { assignedTo, version: { increment: 1 } },
    });
    await tx.incidentHistory.create({
      data: {
        incidentId: id,
        actorId,
        actorType: 'user',
        action: 'assignment_changed',
        details: { from: current.assignedTo, to: assignedTo },
      },
    });
    return tx.incident.findUniqueOrThrow({ where: { id }, include: includeDetails });
  });
}

export async function listAssignableUsers() {
  return prisma.user.findMany({ select: { id: true, email: true, role: true }, orderBy: { email: 'asc' } });
}
