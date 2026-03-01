# Apartment Helpdesk

Minimal, server-rendered ticketing system.

## Local dev (recommended)

Fully local web server + SQLite database (no Cloudflare involved during local development):

```bash
cd /Users/nikhiltr/helpdesk
npm i
npm run migrate:local
npm run dev
```

Open `http://127.0.0.1:8787/` and verify:

- `/_health/` → `ok`
- `/_db/` → `db ok (...)`

SQLite file is `local.db` (inspect with `sqlite3 local.db`).

## Deploy to Cloudflare (later)

This repo is set up for Cloudflare Workers + D1 (SQLite). End-user functionality will remain server-rendered (no JS required).

### 1) Create the D1 database

1. Cloudflare dashboard → **Workers & Pages** → **D1** → **Create database**
2. Name: `helpdesk-db`

Copy the `database_id`.

### 2) Configure `wrangler.toml`

Edit `wrangler.toml` and set:

`database_id = "<your database_id>"`

### 3) Apply migrations (creates tables)

From your machine:

```bash
npm i
npx wrangler d1 migrations apply helpdesk-db
```

### 4) Deploy the Worker

```bash
npx wrangler deploy
```

Then open the deployed URL and check:

- `/_health/` → `ok`
- `/_db/` → `db ok (...)`

If you see a permissions error about Wrangler log files under `~/Library/Preferences/.wrangler` when using Wrangler locally, run with a repo-local HOME:

```bash
HOME="$(pwd)/.home" XDG_CONFIG_HOME="$(pwd)/.config" XDG_CACHE_HOME="$(pwd)/.cache" npm run dev:cf
```
