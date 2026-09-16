import bcrypt from 'bcryptjs';
import { beforeEach } from 'vitest';
import { prisma } from '../src/shared/prisma.js';
import { assertSafeTestDatabase } from './testDatabaseGuard.js';

assertSafeTestDatabase();

export async function resetDb() {
  await prisma.incidentHistory.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.workerHeartbeat.deleteMany();
  await prisma.user.deleteMany();
  const passwordHash = await bcrypt.hash('Password123!', 4);
  const operator = await prisma.user.create({ data: { email: 'operator@example.com', passwordHash, role: 'operator' } });
  const admin = await prisma.user.create({ data: { email: 'admin@example.com', passwordHash, role: 'admin' } });
  return { operator, admin };
}

beforeEach(async () => {
  await resetDb();
});
