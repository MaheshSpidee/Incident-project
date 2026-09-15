import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

function findBackendRoot() {
  let current = path.dirname(fileURLToPath(import.meta.url));
  while (current !== path.dirname(current)) {
    const packagePath = path.join(current, 'package.json');
    if (fs.existsSync(packagePath)) {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as { name?: string };
      if (packageJson.name === 'incident-backend') return current;
    }
    current = path.dirname(current);
  }
  return process.cwd();
}

export const backendRoot = findBackendRoot();
export const backendEnvPath = path.join(backendRoot, '.env');

dotenv.config({ path: backendEnvPath });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('8h'),
  INGESTION_API_KEY: z.string().min(12),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  ESCALATION_THRESHOLD_SECONDS: z.coerce.number().int().positive().default(300),
  ESCALATION_CHECK_INTERVAL_SECONDS: z.coerce.number().int().positive().default(10),
  ESCALATION_BATCH_SIZE: z.coerce.number().int().positive().max(500).default(50),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const missingOrInvalid = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Invalid backend environment configuration. Check backend/.env. ${missingOrInvalid.join('; ')}`);
}

export const env = parsed.data;
