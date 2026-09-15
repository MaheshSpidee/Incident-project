Act as a senior full-stack engineer. Implement a complete, working Incident & Alert Management System for my take-home assignment.

Read Home_Assignment_1.md if available. Follow its requirements and the decisions below. Complete the implementation, run verification, and fix issues. Do not stop after planning or scaffolding. Make reasonable assumptions and document them. Ask questions only for genuine blockers.

Inspect the existing repository and any AGENTS.md before editing. Preserve unrelated work.

PROJECT STRUCTURE

Use exactly these application folders:

* front-end/ — React application.
* backend/ — Node.js with Express API and background worker.

At the repository root, include README.md, DESIGN.md, docker-compose.yml, .gitignore, and convenient scripts where useful.

TECHNOLOGY

* Frontend: React, TypeScript, Vite, React Router, TanStack Query.
* Backend: Node.js, Express, TypeScript, Zod validation.
* Database: PostgreSQL with Prisma migrations.
* Authentication: JWT bearer tokens and bcrypt password hashing.
* Tests: Vitest and Supertest, including meaningful PostgreSQL integration tests.
* Use a supported Node.js LTS version and compatible dependencies. Pin the runtime and commit lockfiles.
* Use one package manager consistently.

Keep the implementation appropriate for an 8–12-hour assignment. Do not implement microservices, Kafka, Redis, Kubernetes, paid integrations, or real notification providers.

BACKEND STRUCTURE

Organize backend/src into config, middleware, modules, workers, and shared utilities.

Within modules, separate routes, validation, controllers, services, and database access as appropriate.

Controllers must not contain database queries. Business rules belong in services. Use consistent async error handling and a centralized error middleware. Never return stack traces or credentials to clients.

DATA MODEL

Implement:

1. User:
   id, email, passwordHash, role (operator/admin), createdAt.

2. Incident:
   id, eventId, source, type, severity, message, status,
   occurredAt, receivedAt, escalationDueAt, escalatedAt,
   acknowledgedAt, resolvedAt, assignedTo, version,
   createdAt, updatedAt.

3. IncidentHistory:
   id, incidentId, fromStatus, toStatus, actorId,
   actorType (user/system/device), action, createdAt.
   Include assignment-change details where applicable.

4. Worker heartbeat persistence sufficient to report the last successful escalation check.

Use UTC timestamps, foreign keys, appropriate enums, and useful indexes. Include a partial index for overdue open high-severity incidents through a SQL migration if necessary.

INGESTION

POST /incidents accepts:
source, type, severity, message, timestamp, and optional eventId.

* Require a configurable ingestion API key, supplied in a request header.
* Do not expose this key in the frontend or client-side environment variables.
* Validate inputs, lengths, supported severity values, and timestamps.
* Map timestamp to occurredAt; set receivedAt on the server.
* Allow clients to omit eventId to remain compatible with the assignment.
* When eventId is supplied, enforce uniqueness on (source, eventId).
* Return the existing incident for identical retries.
* Return 409 if the same event identity is reused with different incident content.
* Handle concurrent duplicate submissions through the database uniqueness constraint.
* Document that requests without eventId have no retry deduplication guarantee.
* Return 201 for creation and 200 for a recognized retry.

AUTHENTICATION AND AUTHORIZATION

Implement:

* POST /auth/login
* GET /auth/me

Use expiring JWTs, a strong configurable signing secret, password hashing, and login rate limiting. Validate token signature and expiration.

For this demo, keep the frontend token in sessionStorage and document the XSS tradeoff. Clear authentication on logout or 401 responses. Never log passwords, API keys, or tokens.

Seed one operator and one admin with clearly documented development-only credentials. No public registration is required.

Enforce authorization on the server:

* Operator and admin: list, view, acknowledge, resolve.
* Admin only: assign/reassign incidents.
* Ingestion credential: create incidents only.

INCIDENT API

Implement:

* POST /incidents
* GET /incidents
* GET /incidents/:id
* PATCH /incidents/:id/status
* PATCH /incidents/:id/assignment
* GET /health/live
* GET /health/ready

Listing supports status, severity, source, page, and limit. Validate pagination and cap page size at 100. Use deterministic ordering by receivedAt descending and id descending. Return pagination metadata.

Incident details include history and assigned-user information without exposing sensitive user fields.

Provide a protected way for admins to retrieve assignable users.

Use consistent responses:

* Success: data and optional pagination metadata.
* Failure: error with code, message, and optional validation details.

Use appropriate 400, 401, 403, 404, 409, 429, and 500 responses.

LIFECYCLE AND CONCURRENCY

Allow only:

* open → acknowledged
* open → escalated, performed by the worker only
* escalated → acknowledged
* acknowledged → resolved

Reject all other transitions with 409. Both operator and admin follow the same lifecycle.

Persist escalatedAt after acknowledgement/resolution. Record lifecycle and assignment changes in history.

Use atomic conditional updates or version checks to prevent stale updates. Update the incident and insert history in the same transaction. An acknowledgement/escalation race must never overwrite an acknowledgement or create inconsistent history.

AUTO-ESCALATION

Implement a separate worker process from the same backend codebase.

Configuration:

* ESCALATION_THRESHOLD_SECONDS, default 300.
* ESCALATION_CHECK_INTERVAL_SECONDS, default 10.
* Configurable bounded batch size.

Set escalationDueAt from server receivedAt when creating a high-severity incident. Configuration changes affect new incidents only.

The worker:

* Immediately checks on startup, then periodically.
* Processes only high-severity incidents still open whose deadline has passed.
* Uses database transactions and FOR UPDATE SKIP LOCKED or an equivalent proven atomic approach.
* Safely supports multiple worker instances.
* Updates status and creates history atomically.
* Prevents overlapping checks within one process.
* Recovers overdue incidents after restart.
* Updates a heartbeat after successful checks.
* Handles shutdown and database failures cleanly.

Do not use one in-memory timer per incident. Explain polling delay and restart behavior in README.

Keep API liveness separate from database readiness and worker health. Expose worker freshness through an authenticated operational response or dashboard status.

FRONTEND

Build a complete responsive interface with:

* Login screen.
* Protected dashboard.
* Incident details page or drawer.
* Status and severity filters plus source search.
* Pagination.
* Acknowledge and resolve actions.
* Admin assignment controls.
* Logout.
* Clear loading, empty, error, and retry states.

Use a clean navy/slate interface, readable typography, and accessible contrast. Use severity/status badges and visibly distinguish escalated incidents with text/icons as well as color.

Display source, type, message, severity, status, age, assignment, and timestamps. Show incident history and historical escalation information.

Poll dashboard data every five seconds while the page is active. Show last successful refresh time and refresh failures. Preserve filters during refresh. Invalidate relevant queries after mutations.

Disable actions while requests are pending. Show 409 conflicts clearly and refresh stale data. Hide unauthorized controls, while retaining all server-side checks.

Do not invent unsupported dashboard totals. Either calculate summaries correctly on the backend or omit them.

Use real API data. Do not leave mocked success responses or placeholder actions.

TESTS

Cover at least:

* Login success/failure, missing/invalid/expired JWTs.
* Operator blocked from admin assignment.
* Ingestion requires its credential.
* Request validation and pagination.
* Valid and invalid status transitions.
* High-severity escalation before and after the deadline.
* Low/medium, acknowledged, and resolved incidents excluded.
* Previously escalated incidents not escalated again.
* Multiple workers processing without duplicate history.
* Concurrent acknowledgement and escalation.
* Overdue processing after a worker restart.
* Duplicate event ingestion and conflicting payloads.
* Transactional history consistency.

Use a separate test database with safeguards against resetting non-test databases. Avoid flaky sleeps; control test timestamps.

Add a small number of frontend tests for important behavior such as authentication redirects and action visibility.

LOCAL SETUP AND DOCUMENTATION

Provide:

* Docker Compose for PostgreSQL, API, worker, and frontend.
* Reliable startup ordering and migrations, avoiding concurrent migration races.
* Idempotent development seeding.
* .env.example files with every required variable.
* Scripts for development, build, type checking, tests, migrations, seed, and worker.
* A sample incident generator or curl examples.
* GitHub Actions for type checks, builds, and meaningful tests with PostgreSQL.
* A fresh-clone setup that works without global tools beyond documented prerequisites.

README must explain setup, accounts, API examples, assumptions, architecture, tests, security tradeoffs, escalation behavior, and limitations. Do not invent time spent; leave actual candidate time accounting for me to fill in.

DESIGN.md should be approximately 1–2 pages and describe scaling to 50,000+ devices:

* Durable ingestion queue and idempotent consumers.
* A high-priority ingestion path with reserved processing capacity.
* Preserve initial server acceptance time through queues.
* PostgreSQL scaling, retention, pagination, optional replicas.
* Transactional outbox and notification queue.
* Provider retries, rate limits, fallback channels, and dead-letter handling.
* Human acknowledgement versus provider delivery.
* Monitoring queue age, escalation lateness, delivery failures, and worker health.
* Explicit limits under partial/total outages and architectural tradeoffs.
* A compact Mermaid diagram.
* Clearly distinguish implemented features from future design.

FINAL VERIFICATION

Run builds, type checks, and tests; fix failures. Start the application and verify the operator/admin workflows and escalation when the environment permits.

Do not claim a check passed unless you ran it. Report environmental blockers precisely.

Finish with a concise summary of implemented features, exact run commands, development accounts, verification results, and remaining limitations.
