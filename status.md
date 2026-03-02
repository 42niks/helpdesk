# Project Status (2026-03-02)

## Summary
- Project: Apartment Helpdesk (server-rendered, mobile-first MVP target)
- Repo path: `/Users/nikhiltr/helpdesk`
- Current phase: foundation/scaffolding complete; product features not started

## Implemented
- Local runtime:
  - `local/dev.mjs`: Node HTTP server (default `127.0.0.1:8787`)
  - `local/migrate.mjs`: applies SQL migration to local SQLite
  - `local.db`: local SQLite DB file
- Cloudflare scaffold:
  - `src/index.ts`: Worker entry with same basic routes
  - `wrangler.toml`: Worker + D1 binding config
  - `migrations/0001_init.sql`: initial schema migration
- Routes available (local + worker):
  - `/` placeholder page
  - `/_health/` returns `ok`
  - `/_db/` checks `meta.schema_version`

## Database
- Current schema is minimal:
  - `meta(key text primary key, value text not null)`
  - seed: `schema_version = 1`
- Full MVP tables are not implemented yet (`users`, `apartments`, `tickets`, etc. missing).

## Commands
- Install deps: `npm i`
- Local migration: `npm run migrate:local`
- Local dev server: `npm run dev`
- Wrangler local dev: `npm run dev:cf`
- Cloudflare deploy: `npm run deploy`

## Known Gaps
- No authentication/session/CSRF
- No role model (resident/admin/staff)
- No CRUD ticket flows
- No assignment, status workflow, comments, or reviews
- No onboarding/ops scripts
- No shared app/router between Node and Worker yet

## Next Priority
1. Expand DB schema for MVP entities and constraints.
2. Build auth + session + CSRF baseline.
3. Implement first thin slice: resident ticket creation/list/detail.
