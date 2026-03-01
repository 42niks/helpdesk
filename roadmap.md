# Apartment Helpdesk — Roadmap

This file is the “source of truth” for what’s been done and what we’re doing next.

Scope reference: `mvp_scope.md` (mobile-first, lightweight, server-rendered, works without JS).

---

## Where we are (as of 2026-03-01)

### ✅ Done

- ✅ Repo created and published: `https://github.com/42niks/helpdesk`
- ✅ MVP scope captured in `mvp_scope.md`
- ✅ A fully-local dev environment exists (no Cloudflare needed for local work):
  - Local HTTP server: `local/dev.mjs`
  - Local SQLite migrations: `local/migrate.mjs`
  - Local DB file: `local.db` (ignored by git)
- ✅ Cloudflare deployment scaffolding exists (for later):
  - Worker entry: `src/index.ts`
  - D1 migration(s): `migrations/`
  - Wrangler config: `wrangler.toml`

### What you can run right now (local)

```bash
cd /Users/nikhiltr/helpdesk
npm i
npm run migrate:local
npm run dev
```

Sanity checks:
- `http://127.0.0.1:8787/_health/` → `ok`
- `http://127.0.0.1:8787/_db/` → `db ok (schema_version=1)`

DB inspection:
```bash
sqlite3 local.db
```

---

## What’s next (high-level)

We now build the actual CRUD helpdesk app in “thin slices”, keeping:

- Server-rendered HTML
- Minimal CSS
- No JS required for core flows
- Strict authorization on every route
- Append-only ticket history (no edits/deletes)

---

## Milestones (full roadmap)

### Milestone 0 — Project foundation (mostly done)

- [x] Local server + local SQLite
- [x] Cloudflare Worker + D1 skeleton
- [ ] Unify local + Cloudflare runtime logic (avoid two separate apps)

**Acceptance:** one shared router/core app used by both:
- Local: Node HTTP server
- Deploy: Cloudflare Worker `fetch()`

---

### Milestone 1 — Database schema (real MVP tables)

Create/expand migrations so these exist with constraints (SQLite/D1 compatible):

- `apartments`
- `users`
  - roles: resident/admin/staff
  - residents belong to exactly one apartment
- `apartment_staff` (payroll link; staff can belong to many apartments)
- `tickets`
  - immutable fields + created timestamps
  - owner is resident user
- `ticket_status_events` (append-only history)
  - enforce valid transitions (Open → Assigned → In Progress → Completed)
- `ticket_comments` (append-only)
  - by resident owner, assigned staff, or apartment admin
- `ticket_reviews`
  - exactly 1 per ticket
  - only for completed tickets

Also add:
- foreign keys and indexes
- soft-deletion fields where needed (prefer “active=false”)

**Acceptance:**
- `npm run migrate:local` creates the full schema
- schema supports all “rules” in `mvp_scope.md`

---

### Milestone 2 — Platform operator tooling (DB-only onboarding)

Because there is no signup/onboarding UI, add simple CLI scripts:

- `npm run ops:create-apartment`
- `npm run ops:create-user` (resident/admin/staff)
- `npm run ops:link-staff` (apartment_staff)
- `npm run ops:deactivate-user`

**Acceptance:**
- You can provision a new apartment + users without writing SQL by hand
- No web UI required for provisioning (per scope)

---

### Milestone 3 — Auth + sessions + CSRF (correct and boring)

Implement:
- Username/password login
- HTTP-only session cookie
- CSRF tokens for every POST form
- Password hashing (bcrypt-equivalent)

Required behaviors:
- Expired session redirects to login
- After login, return user to intended page where possible
- Clear error pages; no stack traces

**Acceptance:**
- Resident/admin/staff can log in and see role-appropriate home
- Unauthorized access returns 403

---

### Milestone 4 — Ticket creation + resident experience (thin slice)

Resident pages:
- Create ticket (form)
- List own tickets
- Ticket detail (status + history + comments)
- Add comment

Rules to enforce:
- Auth required
- Max 5 open tickets per resident
- Minimum description length
- Optional cooldown

**Acceptance:**
- Resident can create and view tickets
- Invalid forms show inline errors and preserve input

---

### Milestone 5 — Admin assignment + admin view

Admin pages:
- List tickets in their apartment
- Ticket detail view
- Assign staff (only staff currently linked to that apartment)

Rules to enforce:
- Only admin assigns staff
- Prevent assigning staff not linked to apartment (server-side)

**Acceptance:**
- Admin can assign tickets and see audit trail

---

### Milestone 6 — Staff workflow + status transitions

Staff pages:
- List assigned tickets (across apartments they are linked to)
- Ticket detail
- Update status (Assigned → In Progress → Completed)
- Add comment

Rules to enforce:
- Only assigned staff updates status
- No invalid jumps
- “Stale form” protection (ticket already completed)

**Acceptance:**
- Ticket flows end-to-end: resident → admin assign → staff complete

---

### Milestone 7 — Reviews + ratings

Resident:
- Leave review/rating for completed tickets (exactly one)

Visibility rules:
- Residents/admins can view ratings + reviews only for staff currently linked to their apartment
- Admins can view overall staff rating platform-wide (no reviews)

**Acceptance:**
- One review per ticket enforced
- Rating aggregates computed correctly

---

### Milestone 8 — Performance + UX hardening (MVP polish)

Non-functional checklist:
- Mobile-first layout (320px)
- No horizontal scroll; centered narrow column
- Minimal CSS, minimal requests
- Pages remain usable without JS

Reliability checklist:
- Friendly error pages
- 403/404 pages
- Duplicate submission protection

**Acceptance:**
- Works well on slow phone/network
- No JS required for any core flow

---

### Milestone 9 — Deployment to Cloudflare (when ready)

Goal: same SQLite schema on D1, same app routes on Worker.

Tasks:
- Confirm `wrangler.toml` has correct `database_id`
- Apply D1 migrations (remote)
- Deploy Worker
- Smoke test: `/_health/`, `/_db/`, login, create ticket

**Acceptance:**
- Production URL works end-to-end
- No reliance on paid services

---

## Definition of “MVP complete”

MVP is complete when:

- Residents can create tickets and comment
- Admins can assign staff and view apartment tickets
- Staff can progress ticket status and comment
- Residents can review completed tickets (one review per ticket)
- Role-based access control is correct on every route
- App is mobile-first, lightweight, and works without JS
- Runs locally and deploys to Cloudflare Workers + D1

