# Apartment Helpdesk

Minimal, server-rendered ticketing system.

## Deploy to Cloudflare (recommended)

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

## Local dev (optional)

```bash
npm i
npm run dev
```
