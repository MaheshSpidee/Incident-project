import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './shared/prisma.js';

const server = createApp().listen(env.PORT, () => {
  console.log(`API listening on ${env.PORT}`);
});

process.on('SIGTERM', async () => {
  server.close();
  await prisma.$disconnect();
});
