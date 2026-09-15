import { env } from '../config/env.js';
import { runEscalationCheck } from '../modules/worker/escalation.service.js';
import { prisma } from '../shared/prisma.js';
import { sanitizeErrorMessage } from '../shared/sanitize.js';

let stopped = false;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const result = await runEscalationCheck();
    console.log('Escalation check complete', result);
  } catch (err) {
    console.error('Escalation check failed', { message: sanitizeErrorMessage(err) });
  } finally {
    running = false;
  }
}

async function main() {
  await tick();
  const timer = setInterval(tick, env.ESCALATION_CHECK_INTERVAL_SECONDS * 1000);
  const shutdown = async () => {
    stopped = true;
    clearInterval(timer);
    while (running) await new Promise((resolve) => setTimeout(resolve, 100));
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  while (!stopped) await new Promise((resolve) => setTimeout(resolve, 60_000));
}

main();
