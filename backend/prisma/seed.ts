import bcrypt from 'bcryptjs';
import { prisma } from '../src/shared/prisma.js';
import { sanitizeErrorMessage } from '../src/shared/sanitize.js';

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
