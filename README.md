# Apartment Helpdesk

Server-rendered apartment ticketing system with role-based workflows for residents, admins, and staff.

## Current Scope

MVP milestones 1-5 are implemented:

- Auth + sessions + CSRF
- Resident ticket create/list/detail/comment flows
- Admin assignment/reassignment and cancellation-complete flow
- Staff status transitions (`assigned -> in_progress -> completed`)
- Resident reviews and apartment/platform staff ratings views

## Architecture

The app is split by domain under [`src/app`](/Users/nikhiltr/helpdesk/src/app):

- [`auth/`](/Users/nikhiltr/helpdesk/src/app/auth): session/auth/role guards
- [`core/`](/Users/nikhiltr/helpdesk/src/app/core): shared data access, utils, views
- [`tickets/`](/Users/nikhiltr/helpdesk/src/app/tickets): ticket flows and validations
- [`pages/`](/Users/nikhiltr/helpdesk/src/app/pages): resident/admin/staff page handlers
- [`errors/`](/Users/nikhiltr/helpdesk/src/app/errors): centralized error/logout handlers
- [`db/`](/Users/nikhiltr/helpdesk/src/app/db): node + d1 adapters
- [`index.mjs`](/Users/nikhiltr/helpdesk/src/app/index.mjs): thin route orchestration

## Frontend Runtime Policy

- Default rule: no client-side JavaScript.
- Approved exception: login page password visibility toggle (`Show/Hide`) on `/`.
- Any additional client-side JavaScript requires explicit approval.

## Local Development

```bash
cd /Users/nikhiltr/helpdesk
npm i
npm run migrate:local
npm run dev
```

Open [http://127.0.0.1:8787/](http://127.0.0.1:8787/).

Quick health checks:

- [http://127.0.0.1:8787/_health/](http://127.0.0.1:8787/_health/) -> `ok`
- [http://127.0.0.1:8787/_db/](http://127.0.0.1:8787/_db/) -> `db ok (schema_version=5)`

Default local DB is `local-dev-db`.
Optional separate DB for dev/test runs: `local-test-db`.

```bash
npm run migrate:test-db
npm run dev:test-db
```

UI demo seed (keeps existing resident/admin actors, resets ticket-domain data, renames/adds staff, and adds broad demo coverage):

```bash
node local/seed-ui-demo.mjs
```

## Testing

Backend tests:

```bash
npm test
npm run test:unit
npm run test:integration
```

Frontend e2e:

```bash
npm run test:e2e
```

Cloudflare local runtime e2e (Worker + D1 via Wrangler):

```bash
npm run test:e2e:cf-local
```

Test organization:

- [`tests/backend/unit/`](/Users/nikhiltr/helpdesk/tests/backend/unit/)
- [`tests/backend/integration/`](/Users/nikhiltr/helpdesk/tests/backend/integration/)
- [`tests/frontend/e2e/specs/`](/Users/nikhiltr/helpdesk/tests/frontend/e2e/specs/)
- [`tests/test_inventory.md`](/Users/nikhiltr/helpdesk/tests/test_inventory.md)

## Migrations

Implemented migrations:

- `0001_init.sql`
- `0002_milestone1_auth_baseline.sql`
- `0003_milestone2_resident_tickets.sql`
- `0004_milestone4_staff_links.sql`
- `0005_milestone5_ratings_reviews.sql`

Current schema version: `5`.

## Cloudflare (Worker + D1)

```bash
# set D1 database_id in wrangler.toml
npm run d1:migrate
npm run deploy
```

Optional local Wrangler run:

```bash
HOME="$(pwd)/.home" XDG_CONFIG_HOME="$(pwd)/.config" XDG_CACHE_HOME="$(pwd)/.cache" npm run dev:cf
```

Cloudflare local e2e prep (applies D1 migrations and seeds fixture data into local Wrangler persistence):

```bash
npm run cf:e2e:prepare
```

Remote D1 safe operations:

```bash
npm run d1:remote:preflight
npm run d1:remote:exec -- "select value from meta where key='schema_version';"
npm run d1:remote:import -- /Users/nikhiltr/helpdesk/local/overwrite_remote_from_local_dev_db.sql
```

`overwrite_remote_from_local_dev_db.sql` is generated from `local-dev-db`; it clears remote `sessions` but does not insert session rows.

See [`local/REMOTE_D1_OPS.md`](/Users/nikhiltr/helpdesk/local/REMOTE_D1_OPS.md) for workflow details.
