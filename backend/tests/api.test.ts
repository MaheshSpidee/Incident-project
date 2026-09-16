import request from 'supertest';
import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/shared/prisma.js';
import { runEscalationCheck } from '../src/modules/worker/escalation.service.js';

const app = createApp();

async function login(email = 'operator@example.com') {
  const res = await request(app).post('/auth/login').send({ email, password: 'Password123!' });
  return res.body.data.token as string;
}

async function ingest(overrides = {}) {
  return request(app).post('/incidents').set('x-ingestion-api-key', env.INGESTION_API_KEY).send({
    source: 'device-1',
    type: 'cpu',
    severity: 'high',
    message: 'CPU hot',
    timestamp: new Date('2026-01-01T00:00:00Z').toISOString(),
    ...overrides,
  });
}

describe('auth', () => {
  it('allows the configured frontend origin through CORS', async () => {
    const origin = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',')[0].trim();
    const res = await request(app).get('/health/live').set('Origin', origin);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
  });

  it('logs in and rejects bad credentials and invalid tokens', async () => {
    expect((await request(app).post('/auth/login').send({ email: 'operator@example.com', password: 'Password123!' })).status).toBe(200);
    expect((await request(app).post('/auth/login').send({ email: 'operator@example.com', password: 'bad' })).status).toBe(401);
    expect((await request(app).get('/auth/me').set('authorization', 'Bearer bad')).status).toBe(401);
    const expired = jwt.sign({ id: 'x', email: 'x@example.com', role: 'operator' }, env.JWT_SECRET, { expiresIn: -1 });
    expect((await request(app).get('/auth/me').set('authorization', `Bearer ${expired}`)).status).toBe(401);
  });
});

describe('incidents', () => {
  it('returns consistent errors for malformed and oversized JSON bodies', async () => {
    const malformed = await request(app)
      .post('/auth/login')
      .set('content-type', 'application/json')
      .send('{"email":');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('malformed_json');

    const oversized = await request(app)
      .post('/auth/login')
      .set('content-type', 'application/json')
      .send(JSON.stringify({ email: 'operator@example.com', password: 'x'.repeat(1_100_000) }));
    expect(oversized.status).toBe(413);
    expect(oversized.body.error.code).toBe('payload_too_large');
  });

  it('requires ingestion key, validates, lists with pagination, and handles duplicate events', async () => {
    expect((await request(app).post('/incidents').send({})).status).toBe(401);
    expect((await request(app).post('/incidents').set('x-ingestion-api-key', env.INGESTION_API_KEY).send({ source: '' })).status).toBe(400);
    expect((await request(app).post('/incidents').set('x-ingestion-api-key', env.INGESTION_API_KEY).send({
      source: 'device-null-time',
      type: 'cpu',
      severity: 'high',
      message: 'Bad timestamp',
      timestamp: null,
    })).status).toBe(400);
    expect((await ingest({ eventId: 'evt-1' })).status).toBe(201);
    expect((await ingest({ eventId: 'evt-1' })).status).toBe(200);
    expect((await ingest({ eventId: 'evt-1', message: 'Changed' })).status).toBe(409);
    const token = await login();
    const list = await request(app).get('/incidents?page=1&limit=5&severity=high').set('authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.pagination.total).toBe(1);
    expect((await request(app).get('/incidents/not-a-uuid').set('authorization', `Bearer ${token}`)).status).toBe(400);
  });

  it('enforces role checks and lifecycle transitions with history', async () => {
    const incident = (await ingest()).body.data;
    const operator = await login();
    const admin = await login('admin@example.com');
    const assignee = await prisma.user.findUniqueOrThrow({ where: { email: 'operator@example.com' } });
    expect((await request(app).patch(`/incidents/${incident.id}/assignment`).set('authorization', `Bearer ${operator}`).send({ assignedTo: null })).status).toBe(403);
    expect((await request(app).get('/incidents/assignable-users').set('authorization', `Bearer ${operator}`)).status).toBe(403);
    const assigned = await request(app).patch(`/incidents/${incident.id}/assignment`).set('authorization', `Bearer ${admin}`).send({ assignedTo: assignee.id, version: incident.version });
    expect(assigned.status).toBe(200);
    expect(assigned.body.data.assignee.email).toBe('operator@example.com');
    expect(assigned.body.data.history.at(-1).action).toBe('assignment_changed');
    expect((await request(app).patch(`/incidents/${incident.id}/assignment`).set('authorization', `Bearer ${admin}`).send({ assignedTo: null, version: incident.version })).status).toBe(409);
    expect((await request(app).patch(`/incidents/${incident.id}/status`).set('authorization', `Bearer ${operator}`).send({ status: 'resolved', version: assigned.body.data.version })).status).toBe(409);
    const ack = await request(app).patch(`/incidents/${incident.id}/status`).set('authorization', `Bearer ${operator}`).send({ status: 'acknowledged', version: assigned.body.data.version });
    expect(ack.status).toBe(200);
    expect(ack.body.data.history.at(-1).action).toBe('acknowledged');
    const resolved = await request(app).patch(`/incidents/${incident.id}/status`).set('authorization', `Bearer ${admin}`).send({ status: 'resolved', version: ack.body.data.version });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data.history.at(-1).action).toBe('resolved');
    expect((await prisma.incidentHistory.count({ where: { incidentId: incident.id } }))).toBe(4);
  });
});

describe('escalation worker', () => {
  it('escalates only overdue open high incidents and excludes others', async () => {
    await ingest({ source: 'overdue', eventId: '1' });
    await ingest({ source: 'low', severity: 'low', eventId: '2' });
    await ingest({ source: 'medium', severity: 'medium', eventId: '3' });
    await ingest({ source: 'future-high', eventId: '4' });
    await ingest({ source: 'ack-high', eventId: '5' });
    await ingest({ source: 'resolved-high', eventId: '6' });
    await prisma.incident.updateMany({ where: { source: 'overdue' }, data: { escalationDueAt: new Date('2026-01-01T00:00:00Z') } });
    await prisma.incident.updateMany({ where: { source: 'future-high' }, data: { escalationDueAt: new Date('2026-01-01T00:20:00Z') } });
    await prisma.incident.updateMany({ where: { source: 'ack-high' }, data: { status: 'acknowledged', acknowledgedAt: new Date('2026-01-01T00:01:00Z'), escalationDueAt: new Date('2026-01-01T00:00:00Z') } });
    await prisma.incident.updateMany({ where: { source: 'resolved-high' }, data: { status: 'resolved', acknowledgedAt: new Date('2026-01-01T00:01:00Z'), resolvedAt: new Date('2026-01-01T00:02:00Z'), escalationDueAt: new Date('2026-01-01T00:00:00Z') } });
    const result = await runEscalationCheck(new Date('2026-01-01T00:10:00Z'));
    expect(result.escalated).toBe(1);
    expect((await runEscalationCheck(new Date('2026-01-01T00:11:00Z'))).escalated).toBe(0);
    expect(await prisma.incidentHistory.count({ where: { action: 'auto_escalated' } })).toBe(1);
    const statuses = await prisma.incident.findMany({ where: { source: { in: ['low', 'medium', 'future-high', 'ack-high', 'resolved-high'] } }, select: { source: true, status: true } });
    expect(Object.fromEntries(statuses.map((item) => [item.source, item.status]))).toMatchObject({
      low: 'open',
      medium: 'open',
      'future-high': 'open',
      'ack-high': 'acknowledged',
      'resolved-high': 'resolved',
    });
  });

  it('recovers overdue incidents after restart and records heartbeat', async () => {
    await ingest({ source: 'restart-device', eventId: 'restart-1' });
    await prisma.incident.updateMany({ where: { source: 'restart-device' }, data: { escalationDueAt: new Date('2026-01-01T00:00:00Z') } });
    const result = await runEscalationCheck(new Date('2026-01-01T00:20:00Z'));
    const heartbeat = await prisma.workerHeartbeat.findUnique({ where: { name: 'escalation' } });
    expect(result.escalated).toBe(1);
    expect(heartbeat?.lastSuccessfulCheckAt.toISOString()).toBe('2026-01-01T00:20:00.000Z');
  });

  it('allows multiple worker checks without duplicate escalation history', async () => {
    await ingest({ source: 'multi-worker', eventId: 'mw-1' });
    await prisma.incident.updateMany({ where: { source: 'multi-worker' }, data: { escalationDueAt: new Date('2026-01-01T00:00:00Z') } });
    const results = await Promise.all([
      runEscalationCheck(new Date('2026-01-01T00:10:00Z')),
      runEscalationCheck(new Date('2026-01-01T00:10:00Z')),
    ]);
    expect(results.reduce((sum, item) => sum + item.escalated, 0)).toBe(1);
    expect(await prisma.incidentHistory.count({ where: { action: 'auto_escalated' } })).toBe(1);
  });

  it('does not overwrite acknowledgement during an escalation race', async () => {
    const incident = (await ingest({ eventId: 'race' })).body.data;
    await prisma.incident.update({ where: { id: incident.id }, data: { escalationDueAt: new Date('2026-01-01T00:00:00Z') } });
    const token = await login();
    const [, ackResponse] = await Promise.all([
      runEscalationCheck(new Date('2026-01-01T00:10:00Z')),
      request(app).patch(`/incidents/${incident.id}/status`).set('authorization', `Bearer ${token}`).send({ status: 'acknowledged' }),
    ]);
    expect([200, 409]).toContain(ackResponse.status);
    const current = await prisma.incident.findUniqueOrThrow({ where: { id: incident.id } });
    expect(['escalated', 'acknowledged']).toContain(current.status);
    const history = await prisma.incidentHistory.findMany({ where: { incidentId: incident.id }, orderBy: { createdAt: 'asc' } });
    expect(history.filter((item) => item.action === 'auto_escalated')).toHaveLength(current.escalatedAt ? 1 : 0);
    const ack = history.find((item) => item.action === 'acknowledged');
    if (ackResponse.status === 200) expect(ack).toBeTruthy();
    if (history.some((item) => item.action === 'auto_escalated') && ack) {
      expect(ack.fromStatus).toBe('escalated');
    }
  });
});
