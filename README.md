# Incident & Alert Management System

Full-stack take-home implementation with:

- `front-end/`: React, TypeScript, Vite, React Router, and TanStack Query.
- `backend/`: Express, TypeScript, Prisma, PostgreSQL, JWT authentication, and a separate escalation worker.

The project is intentionally scoped for an 8-12 hour assignment. It does not include real notification providers, Kafka/Redis/Kubernetes, public registration, or production observability infrastructure.

## Prerequisites

- Node.js 24 LTS.
- npm, using the committed `package-lock.json`.
- PostgreSQL 16 or compatible local PostgreSQL for host-run development.
- Docker and Docker Compose only if you want to run the Compose stack.

Install dependencies from the repository root:

```bash
npm ci
```

## Environment Setup

Create local environment files without overwriting existing secrets:

```bash
[ -f backend/.env ] || cp backend/.env.example backend/.env
[ -f front-end/.env ] || cp front-end/.env.example front-end/.env
```

Fill in `backend/.env`:

```dotenv
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/<database>?schema=public
JWT_SECRET=replace-with-at-least-32-random-characters
JWT_EXPIRES_IN=8h
INGESTION_API_KEY=replace-with-random-ingestion-key
CORS_ORIGIN=http://localhost:5173
ESCALATION_THRESHOLD_SECONDS=300
ESCALATION_CHECK_INTERVAL_SECONDS=10
ESCALATION_BATCH_SIZE=50
```

Fill in `front-end/.env`:

```dotenv
VITE_API_BASE_URL=http://localhost:4000
```

The ingestion API key is server-only. Do not expose it through a `VITE_` frontend variable.

## Local Database

Create a development database and role before running migrations. Use your own local PostgreSQL role and password; do not use personal credentials in committed files.

Example shape:

```sql
CREATE ROLE <dev_user> LOGIN PASSWORD '<dev_password>';
CREATE DATABASE incident_dev OWNER <dev_user>;
```

Then set `backend/.env`:

```dotenv
DATABASE_URL=postgresql://<dev_user>:<dev_password>@localhost:5432/incident_dev?schema=public
```

If your local PostgreSQL uses peer authentication, a passwordless URL such as `postgresql://<local_os_role>@localhost:5432/incident_dev?schema=public` may also work.

## Local Startup

Run these commands from the repository root after `.env` files are populated:

```bash
npm run db:migrate
npm run db:seed
npm run build
```

Start the API in terminal 1:

```bash
npm run start -w backend
```

Start the worker in terminal 2:

```bash
npm run worker
```

Start the frontend in terminal 3:

```bash
npm run dev -w front-end
```

Default local ports:

- API: `http://localhost:4000`
- Frontend: `http://localhost:5173`

`front-end/vite.config.ts` uses strict port `5173`. Keep `backend/.env` `CORS_ORIGIN` aligned with the frontend URL. The backend accepts a comma-separated `CORS_ORIGIN` allow-list.

Development seed accounts:

- Operator: `operator@example.com` / `Password123!`
- Admin: `admin@example.com` / `Password123!`

These credentials are development-only and are seeded idempotently.

## Docker Compose

Compose configuration is in `docker-compose.yml`. It defines:

- `postgres`: PostgreSQL 16, with Compose-local credentials.
- `migrate`: runs Prisma migrations and seed before app startup.
- `api`: Express API on host port `4000`.
- `worker`: escalation worker.
- `frontend`: Nginx-served built frontend on host port `5173`.

Inside Compose, services connect to PostgreSQL with host `postgres`, not `localhost`:

```text
postgresql://incident:incident@postgres:5432/incident_dev?schema=public
```

Host-run applications connect through the published port on `localhost` and should use a `localhost` database URL in `backend/.env`.

The frontend Docker image receives `VITE_API_BASE_URL` at build time from the Compose build argument:

```yaml
VITE_API_BASE_URL: http://localhost:4000
```

Run the Compose stack:

```bash
docker compose up --build
```

The Dockerfiles use `npm ci` with the root lockfile, so a separate host `npm run build` is not required before `docker compose up --build`.

Docker runtime startup has not been verified in this environment because Docker was unavailable during validation.

## API Examples

Ingest an incident:

```bash
curl -X POST http://localhost:4000/incidents \
  -H 'content-type: application/json' \
  -H 'x-ingestion-api-key: replace-with-random-ingestion-key' \
  -d '{"source":"device-1","type":"cpu","severity":"high","message":"CPU temperature critical","timestamp":"2026-01-01T00:00:00Z","eventId":"device-1-evt-1"}'
```

Login:

```bash
curl -X POST http://localhost:4000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@example.com","password":"Password123!"}'
```

Use the returned JWT as a bearer token for protected incident and health-worker endpoints.

## Implemented Behavior and Assumptions

PostgreSQL is used because incident data is structured and relational: incidents, users, assignment references, lifecycle history, and worker heartbeat rows benefit from foreign keys, indexes, transactions, row locks, and filtered pagination queries.

The backend is modular by route/service area, and the escalation worker is a separate process from the same codebase. This keeps the assignment small while still separating request handling from background polling.

Authentication uses bcrypt-hashed passwords and expiring JWT bearer tokens. The frontend stores the token in `sessionStorage` for demo simplicity. This avoids longer-lived `localStorage`, but any browser storage token is exposed to successful XSS; a production version should consider httpOnly cookies, CSP, and tighter session controls.

Lifecycle transitions allowed by the server:

- `open -> acknowledged`
- `open -> escalated` by the worker only
- `escalated -> acknowledged`
- `acknowledged -> resolved`

Escalated incidents must be acknowledged before they can be resolved. `escalatedAt` remains persisted after acknowledgement and resolution, and history records the escalation.

Escalation assumptions:

- Escalation deadlines use server `receivedAt`, not the device occurrence timestamp.
- `escalationDueAt` is stored on incident creation for high-severity incidents.
- Later configuration changes affect new incidents only; existing stored deadlines are not recalculated.
- Under healthy operation with sufficient processing capacity, escalation normally occurs within approximately one polling interval after its deadline. Backlogs, database failures, or worker downtime can increase this delay.

Ingestion idempotency:

- `eventId` is optional for assignment compatibility.
- If `eventId` is omitted, there is no retry deduplication guarantee.
- If `eventId` is supplied, `(source, eventId)` is unique.
- Identical retries return the existing incident with `200`.
- Reusing the same event identity with different content returns `409`.

## Verification

Safe automated test command, using a separate test database:

```bash
DATABASE_URL='postgresql://<test_user>:<test_password>@localhost:5432/incident_project_test?schema=public' \
JWT_SECRET='replace-with-at-least-32-random-characters' \
INGESTION_API_KEY='replace-with-random-ingestion-key' \
npm test
```

The backend test setup refuses to run unless `process.env.DATABASE_URL` contains the substring `test`. This is a useful safeguard against accidentally resetting the normal development database, but it is a string check, not a complete database safety policy. Use a dedicated test database.

Other verification commands:

```bash
npm run typecheck
npm run build
npm run db:migrate
npm run db:seed
```

Verification evidence from this environment:

- Type checks were run successfully.
- Production builds were run successfully.
- Backend and frontend automated tests were run successfully against a separate local test database.
- Live API and worker checks were run locally against PostgreSQL.
- Frontend HTTP serving was checked by requesting the Vite-served HTML.
- Browser desktop/mobile interaction was not performed because no browser instance was available to the browser tooling.
- Docker runtime verification was not performed because Docker was unavailable.

Frontend HTTP serving is not the same as browser end-to-end interaction.

## Limitations and Future Improvements

- No real notification providers or delivery audit.
- No durable ingestion queue in the implemented assignment.
- No public registration or user management UI.
- No retention jobs or archival workflow.
- No measured load capacity.
- No browser-verified responsive/accessibility pass in this environment.
- Future work: notification outbox, provider retries, retention/partitioning after volume is known, richer audit views, httpOnly-cookie auth option, and operational dashboards.

## Time Spent

Current assignment time accounting:

| Category | Time |
| --- | --- |
| Backend API and data model | 2.0 hours |
| Escalation worker and concurrency | 1.5 hours |
| Frontend dashboard | 1.5 hours |
| Tests and verification | 2.0 hours |
| Documentation and cleanup | 1.0 hour |
| Total | 8.0 hours |
