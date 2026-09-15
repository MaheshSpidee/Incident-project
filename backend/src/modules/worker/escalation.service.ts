import { env } from '../../config/env.js';
import { prisma } from '../../shared/prisma.js';

export async function runEscalationCheck(now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      WITH picked AS (
        SELECT "id", "status"
        FROM "Incident"
        WHERE "severity" = 'high'
          AND "status" = 'open'
          AND "escalationDueAt" IS NOT NULL
          AND "escalationDueAt" <= ${now}
        ORDER BY "escalationDueAt" ASC, "id" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${env.ESCALATION_BATCH_SIZE}
      ),
      updated AS (
        UPDATE "Incident" i
        SET "status" = 'escalated',
            "escalatedAt" = ${now},
            "version" = i."version" + 1,
            "updatedAt" = ${now}
        FROM picked
        WHERE i."id" = picked."id" AND i."status" = 'open'
        RETURNING i."id"
      )
      INSERT INTO "IncidentHistory" ("incidentId", "fromStatus", "toStatus", "actorType", "action", "createdAt")
      SELECT "id", 'open'::"IncidentStatus", 'escalated'::"IncidentStatus", 'system'::"ActorType", 'auto_escalated', ${now}
      FROM updated
      RETURNING "incidentId" as "id"
    `;

    await tx.workerHeartbeat.upsert({
      where: { name: 'escalation' },
      update: {
        lastSuccessfulCheckAt: now,
        checkedCount: { increment: 1 },
        escalatedCount: { increment: rows.length },
      },
      create: {
        name: 'escalation',
        lastSuccessfulCheckAt: now,
        checkedCount: 1,
        escalatedCount: rows.length,
      },
    });
    return { escalated: rows.length };
  });
}
