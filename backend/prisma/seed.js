import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

function findBackendRoot() {
  let current = path.dirname(fileURLToPath(import.meta.url));
  while (current !== path.dirname(current)) {
    const packagePath = path.join(current, 'package.json');
    if (fs.existsSync(packagePath)) {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      if (packageJson.name === 'incident-backend') return current;
    }
    current = path.dirname(current);
  }
  return process.cwd();
}

function sanitizeErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/User `[^`]+` was denied access on the database `[^`]+`/g, 'Database access was denied')
    .replace(/role "[^"]+" does not exist/g, 'configured database role does not exist')
    .replace(/(postgresql:\/\/)[^\s]+/g, '$1<redacted>');
}

dotenv.config({ path: path.join(findBackendRoot(), '.env') });

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn'] : [],
});

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 12);
  await prisma.user.upsert({
    where: { email: 'operator@example.com' },
    update: { passwordHash, role: 'operator' },
    create: { email: 'operator@example.com', passwordHash, role: 'operator' },
  });
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { passwordHash, role: 'admin' },
    create: { email: 'admin@example.com', passwordHash, role: 'admin' },
  });
}

main()
  .catch((error) => {
    console.error(`Seed failed: ${sanitizeErrorMessage(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
