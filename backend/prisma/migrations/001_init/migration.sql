CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "UserRole" AS ENUM ('operator', 'admin');
CREATE TYPE "IncidentSeverity" AS ENUM ('low', 'medium', 'high');
CREATE TYPE "IncidentStatus" AS ENUM ('open', 'escalated', 'acknowledged', 'resolved');
CREATE TYPE "ActorType" AS ENUM ('user', 'system', 'device');

CREATE TABLE "User" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "Incident" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId" TEXT,
  "source" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "severity" "IncidentSeverity" NOT NULL,
  "message" TEXT NOT NULL,
  "status" "IncidentStatus" NOT NULL DEFAULT 'open',
  "occurredAt" TIMESTAMPTZ NOT NULL,
  "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "escalationDueAt" TIMESTAMPTZ,
  "escalatedAt" TIMESTAMPTZ,
  "acknowledgedAt" TIMESTAMPTZ,
  "resolvedAt" TIMESTAMPTZ,
  "assignedTo" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "Incident_source_eventId_key" ON "Incident"("source", "eventId");
CREATE INDEX "Incident_status_severity_receivedAt_idx" ON "Incident"("status", "severity", "receivedAt");
CREATE INDEX "Incident_source_idx" ON "Incident"("source");
CREATE INDEX "Incident_receivedAt_id_idx" ON "Incident"("receivedAt", "id");
CREATE INDEX "Incident_overdue_open_high_idx" ON "Incident"("escalationDueAt", "id") WHERE "severity" = 'high' AND "status" = 'open';

CREATE TABLE "IncidentHistory" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "incidentId" UUID NOT NULL REFERENCES "Incident"("id") ON DELETE CASCADE,
  "fromStatus" "IncidentStatus",
  "toStatus" "IncidentStatus",
  "actorId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "actorType" "ActorType" NOT NULL,
  "action" TEXT NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "IncidentHistory_incidentId_createdAt_idx" ON "IncidentHistory"("incidentId", "createdAt");

CREATE TABLE "WorkerHeartbeat" (
  "name" TEXT PRIMARY KEY,
  "lastSuccessfulCheckAt" TIMESTAMPTZ NOT NULL,
  "checkedCount" INTEGER NOT NULL DEFAULT 0,
  "escalatedCount" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
