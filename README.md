# Apartment Helpdesk

Server-rendered apartment ticketing system (MVP implemented).

## About the project

Apartment Helpdesk is a lightweight ticketing system for apartment operations.
It is designed for resident issue reporting and role-based workflows between residents, apartment admins, and staff.

Core product goals:

- Server-rendered pages with no JavaScript required for primary flows
- Mobile-first UX and low-overhead runtime
- Clear authorization boundaries per apartment
- Auditable ticket lifecycle (assignment, status updates, comments, reviews)

## Local development (recommended)

```bash
cd /Users/nikhiltr/helpdesk
npm i
npm run migrate:local
npm run dev
```

Open `http://127.0.0.1:8787/`.

Quick checks:

- `http://127.0.0.1:8787/_health/` -> `ok`
- `http://127.0.0.1:8787/_db/` -> `db ok (schema_version=4)`

Default local app DB is `local-dev-db` (inspect with `sqlite3 local-dev-db`).

Separate coding/test DB is `local-test-db`.

```bash
npm run migrate:test-db
npm run dev:test-db
```

## Cloudflare scaffold (ready when needed)

This repo is already wired for Cloudflare Workers + D1 deployment.

```bash
# set your D1 database_id in wrangler.toml first
npm i
npx wrangler d1 migrations apply helpdesk-db
npx wrangler deploy
```

For local Wrangler dev (if needed):

```bash
HOME="$(pwd)/.home" XDG_CONFIG_HOME="$(pwd)/.config" XDG_CACHE_HOME="$(pwd)/.cache" npm run dev:cf
```
