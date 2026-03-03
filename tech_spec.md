# Apartment Helpdesk - Technical Specification

## 1. Document Control
### 1.1 Version and Status
- Version: 1.0
- Status: Draft ready for implementation
- Date: 2026-03-03
- Scope: MVP only

### 1.2 Owners and Reviewers
- Product owner: platform operator (repository owner)
- Technical owner: backend/full-stack implementer
- Reviewers: implementation contributors and operators running production deploys

### 1.3 Related Documents
- `README.md`
- `status.md`
- `scope.md`
- `prd.md`
- `wrangler.toml`


## 2. Problem Statement and Goals
### 2.1 Background
Apartments currently use manual issue tracking (paper/notebook), which causes weak ownership, poor status visibility, and no reliable audit trail. The MVP replaces this with a server-rendered workflow for residents, apartment admins, and shared staff.

### 2.2 MVP Goals
1. Implement full ticket lifecycle: `Open -> Assigned -> In Progress -> Completed`.
2. Enforce role and apartment authorization server-side on every protected route.
3. Keep UI mobile-first and usable with JavaScript disabled for all core flows.
4. Preserve auditable history for assignment/status/comments/review.
5. Keep operational setup and hosting low-cost and simple.

### 2.3 Non-Goals
1. Public signup/self-service onboarding.
2. Payments/billing.
3. Attachments/media.
4. Real-time updates/chat.
5. Notification pipelines.
6. Background workers/queues.
7. Platform operator admin UI.

### 2.4 Success Metrics
1. Assignment latency: `assigned_at - created_at`.
2. Completion latency: `completed_at - created_at`.
3. Completion rate: completed tickets / created tickets.
4. Review submission rate: reviewed completed tickets / completed tickets.
5. Authorization defects at release: 0 known unresolved.
6. JS-off functional checks: all critical flows pass.

## 3. Scope and Constraints
### 3.1 In Scope
1. Username/password authentication and session management.
2. Resident create/list/detail/comment/review flows.
3. Admin apartment queue, assign/reassign, close duplicate/invalid with reason comment.
4. Staff assigned queue, status progression, commenting.
5. Apartment-scoped ratings/reviews and admin platform-wide rating summary (counts/averages only).
6. Manual DB provisioning model for apartments/users/staff links.

### 3.2 Out of Scope
1. Notifications and escalation logic.
2. File upload support.
3. External integrations.
4. Automation jobs outside request/response cycle.
5. Multi-admin identity split (shared apartment admin account remains).

### 3.3 Assumptions
1. Initial usage is low and fits D1 + single Worker.
2. Manual provisioning by operator is acceptable for MVP.
3. Utility UI is acceptable if robust and clear.
4. No cooldown throttle in MVP unless abuse appears.

### 3.4 Constraints
1. Must run locally using Node + SQLite and in production on Cloudflare Worker + D1.
2. Must avoid heavy client frameworks and client-side rendering.
3. Must function at 320px width with no horizontal scrolling.
4. Must enforce data integrity with foreign keys and constraints.
5. Must fail gracefully everywhere and show verbose error details to the user (project-specific policy).

## 4. System Overview
### 4.1 Actors and Roles
- Resident: apartment-bound shared flat account, creates and tracks tickets for that flat.
- Admin: apartment-bound shared manager account, manages queue and staff assignment.
- Staff: can be linked to multiple apartments, sees only tickets assigned to self.
- Platform operator: provisions/maintains data directly in DB (no MVP UI).

### 4.2 Core Workflows
1. Resident login -> create ticket -> track progress -> comment -> submit one review after completion.
2. Admin login -> inspect apartment queue -> assign/reassign eligible staff -> comment -> close invalid/duplicate tickets with reason.
3. Staff login -> view assigned queue -> progress status forward -> comment -> complete ticket.

### 4.3 High-Level Architecture Context
1. Presentation: server-rendered HTML pages and forms.
2. Application: shared route/handler logic (targeted shared module across local and Worker runtimes).
3. Persistence: SQLite-compatible schema used by both local SQLite and Cloudflare D1.
4. Runtime A (local): Node HTTP server (`local/dev.mjs`).
5. Runtime B (cloud): Cloudflare Worker entry (`src/index.ts`) with D1 binding.

## 5. Architecture and Runtime Design
### 5.1 Local Runtime (Node + SQLite)
- Entry: `npm run dev` -> `node local/dev.mjs`.
- DB file: `local.db`.
- Host/port defaults: `127.0.0.1:8787`.
- Migration command: `npm run migrate:local`.
- Local runtime should mirror cloud behavior for routing, auth checks, and HTML rendering.

Implementation direction:
1. Extract shared app logic into `src/app/*`.
2. Keep runtime adapters thin:
- Node adapter: request/response bridge + SQLite driver wrapper.
- Worker adapter: fetch handler + D1 wrapper.

### 5.2 Cloud Runtime (Worker + D1)
- Entry: `src/index.ts`.
- Worker config: `wrangler.toml`.
- D1 binding: `DB`.
- Production deploy: `npm run deploy` (wrangler deploy to Cloudflare).

Runtime behavior requirements:
1. Same route map and validation semantics as local.
2. Same session/cookie/CSRF behavior.
3. Same HTML output semantics (modulo minor runtime-specific headers).

### 5.3 Request Lifecycle
1. Request enters runtime adapter.
2. Router resolves path + method.
3. Session middleware authenticates user (if required route).
4. CSRF middleware validates state-changing form requests.
5. Handler performs authorization and validation.
6. Handler executes parameterized DB operations in transaction for mutations.
7. Server template renderer returns HTML response.
8. Central error boundary renders graceful error page with verbose details.

### 5.4 Server-Rendered UI Strategy (No-JS Core)
1. Every core action uses plain HTML forms and server redirects.
2. POST success should use `303 See Other` to prevent resubmit-on-refresh.
3. Validation failures return `422` with inline errors and preserved safe form input.
4. JavaScript is optional for enhancement only (for example, star rating UX), never required.
5. CSS-only behavior is allowed if content remains fully usable and readable without JS.

## 6. Data Model and Persistence
### 6.1 Domain Entities and Relationships
Core entities:
1. `apartments`
2. `accounts` (credentials + role)
3. `residents`
4. `admins`
5. `staff`
6. `staff_apartment_links`
7. `tickets`
8. `ticket_events`
9. `ticket_comments`
10. `ticket_reviews`
11. `sessions`
12. `schema_migrations`
13. `meta`

Relationship summary:
1. One `account` has exactly one role profile (`residents` or `admins` or `staff`).
2. Resident/admin belong to one apartment.
3. Staff can belong to many apartments through active links.
4. Ticket belongs to one apartment and one resident; optional assigned staff.
5. Ticket has many events/comments and at most one review.
6. Sessions belong to accounts and expire.

### 6.2 Schema Design
Status and enum values are stored as lowercase text in DB, with label mapping done in views/templates.

#### 6.2.1 apartments
- `id INTEGER PRIMARY KEY`
- `name TEXT NOT NULL UNIQUE`
- `code TEXT NOT NULL UNIQUE` (short code for ticket number prefix)
- `is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1))`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

#### 6.2.2 accounts
- `id INTEGER PRIMARY KEY`
- `username TEXT NOT NULL UNIQUE COLLATE NOCASE`
- `password_hash TEXT NOT NULL`
- `role TEXT NOT NULL CHECK (role IN ('resident','admin','staff'))`
- `is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1))`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `last_login_at TEXT`

#### 6.2.3 residents
- `account_id INTEGER PRIMARY KEY REFERENCES accounts(id)`
- `apartment_id INTEGER NOT NULL REFERENCES apartments(id)`
- `full_name TEXT NOT NULL`
- `flat_number TEXT NOT NULL`
- `mobile_number TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

Constraint:
- `UNIQUE(apartment_id, flat_number)` to enforce one resident account per flat per apartment in MVP.

#### 6.2.4 admins
- `account_id INTEGER PRIMARY KEY REFERENCES accounts(id)`
- `apartment_id INTEGER NOT NULL UNIQUE REFERENCES apartments(id)`
- `display_name TEXT NOT NULL`
- `mobile_number TEXT`
- `is_shared_account INTEGER NOT NULL DEFAULT 1 CHECK (is_shared_account = 1)`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

#### 6.2.5 staff
- `account_id INTEGER PRIMARY KEY REFERENCES accounts(id)`
- `full_name TEXT NOT NULL`
- `mobile_number TEXT NOT NULL`
- `staff_type TEXT NOT NULL CHECK (staff_type IN ('electrician','plumber'))`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

#### 6.2.6 staff_apartment_links
- `id INTEGER PRIMARY KEY`
- `staff_account_id INTEGER NOT NULL REFERENCES staff(account_id)`
- `apartment_id INTEGER NOT NULL REFERENCES apartments(id)`
- `is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1))`
- `linked_at TEXT NOT NULL`
- `unlinked_at TEXT`

Indexes/constraints:
- `CREATE UNIQUE INDEX uniq_staff_apartment_active ON staff_apartment_links(staff_account_id, apartment_id) WHERE is_active = 1;`

#### 6.2.7 tickets
- `id INTEGER PRIMARY KEY`
- `ticket_number TEXT NOT NULL UNIQUE`
- `apartment_id INTEGER NOT NULL REFERENCES apartments(id)`
- `resident_account_id INTEGER NOT NULL REFERENCES residents(account_id)`
- `resident_flat_snapshot TEXT NOT NULL`
- `issue_type TEXT NOT NULL CHECK (issue_type IN ('electrical','plumbing'))`
- `title TEXT NOT NULL`
- `description TEXT NOT NULL`
- `status TEXT NOT NULL CHECK (status IN ('open','assigned','in_progress','completed'))`
- `assigned_staff_account_id INTEGER REFERENCES staff(account_id)`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `assigned_at TEXT`
- `in_progress_at TEXT`
- `completed_at TEXT`
- `completed_by_admin_cancel INTEGER NOT NULL DEFAULT 0 CHECK (completed_by_admin_cancel IN (0,1))`

Indexes:
- `(resident_account_id, status, updated_at DESC)`
- `(apartment_id, status, updated_at DESC)`
- `(assigned_staff_account_id, status, updated_at DESC)`

#### 6.2.8 ticket_events
- `id INTEGER PRIMARY KEY`
- `ticket_id INTEGER NOT NULL REFERENCES tickets(id)`
- `event_type TEXT NOT NULL CHECK (event_type IN ('created','assigned','reassigned','status_changed','admin_completed_cancel'))`
- `from_status TEXT CHECK (from_status IN ('open','assigned','in_progress','completed'))`
- `to_status TEXT CHECK (to_status IN ('open','assigned','in_progress','completed'))`
- `from_staff_account_id INTEGER REFERENCES staff(account_id)`
- `to_staff_account_id INTEGER REFERENCES staff(account_id)`
- `actor_account_id INTEGER NOT NULL REFERENCES accounts(id)`
- `actor_role TEXT NOT NULL CHECK (actor_role IN ('resident','admin','staff'))`
- `note_text TEXT`
- `created_at TEXT NOT NULL`

#### 6.2.9 ticket_comments
- `id INTEGER PRIMARY KEY`
- `ticket_id INTEGER NOT NULL REFERENCES tickets(id)`
- `author_account_id INTEGER NOT NULL REFERENCES accounts(id)`
- `author_role TEXT NOT NULL CHECK (author_role IN ('resident','admin','staff'))`
- `comment_text TEXT NOT NULL`
- `created_at TEXT NOT NULL`

#### 6.2.10 ticket_reviews
- `id INTEGER PRIMARY KEY`
- `ticket_id INTEGER NOT NULL UNIQUE REFERENCES tickets(id)`
- `resident_account_id INTEGER NOT NULL REFERENCES residents(account_id)`
- `staff_account_id INTEGER NOT NULL REFERENCES staff(account_id)`
- `rating INTEGER CHECK (rating BETWEEN 1 AND 5)`
- `review_text TEXT`
- `created_at TEXT NOT NULL`
- `CHECK (rating IS NOT NULL OR review_text IS NULL OR length(trim(review_text)) = 0)`

#### 6.2.11 sessions
- `id INTEGER PRIMARY KEY`
- `token_hash TEXT NOT NULL UNIQUE`
- `account_id INTEGER NOT NULL REFERENCES accounts(id)`
- `csrf_token TEXT NOT NULL`
- `expires_at TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `last_seen_at TEXT NOT NULL`
- `revoked_at TEXT`
- `user_agent TEXT`
- `ip_address TEXT`

Indexes:
- `(account_id)`
- `(expires_at)`

#### 6.2.12 schema_migrations
- `version TEXT PRIMARY KEY`
- `applied_at TEXT NOT NULL`

#### 6.2.13 meta
- Keep existing `meta(key, value)` table.
- `schema_version` remains for simple health checks.

### 6.3 Data Integrity Rules
1. `PRAGMA foreign_keys=ON` in both runtimes.
2. All ticket mutations run in transactions.
3. Review uniqueness enforced with `UNIQUE(ticket_id)`.
4. Active staff-apartment linkage required for assignment.
5. Staff type must match ticket issue type at assignment.
6. Each flat cannot exceed 5 active tickets (`open`,`assigned`,`in_progress`), enforced by `(apartment_id, resident_flat_snapshot)`.
7. Soft deactivation (`is_active=0`) is preferred over hard delete.
8. Ticket history is append-only: no delete/update for comments/reviews/events except controlled migration scripts.

### 6.4 Migration Strategy
1. Add incremental files: `migrations/0002_*.sql`, `0003_*.sql`, etc.
2. Add migration ledger support via `schema_migrations` and apply each file once.
3. Keep migrations forward-only; no down migrations required for MVP.
4. Migration script must apply files in lexical order within transaction per file.
5. Rollback strategy is restore from backup + redeploy prior migration set.

## 7. API and Route Specification
### 7.1 Route Inventory

#### Public/System Routes
| Method | Route | Purpose |
|---|---|---|
| GET | `/` | Helpdesk login page |
| POST | `/login` | Authenticate user |
| POST | `/logout` | End session |
| GET | `/_health/` | Liveness check |
| GET | `/_db/` | DB connectivity + schema version check |
| GET | `/403` | Forbidden page |
| GET | `/404` | Not found page |
| GET | `/500` | Generic error page |

#### Resident Routes
| Method | Route | Purpose |
|---|---|---|
| GET | `/resident` | Resident home and ticket list |
| GET | `/tickets/new` | New ticket form |
| POST | `/tickets` | Create ticket |
| GET | `/tickets/:id` | Ticket detail (shared route, resident view) |
| POST | `/tickets/:id/comments` | Add comment |
| POST | `/tickets/:id/review` | Submit review |
| GET | `/resident/staff-ratings` | Apartment staff ratings/reviews |
| GET | `/resident/account` | Resident account details |

#### Admin Routes
| Method | Route | Purpose |
|---|---|---|
| GET | `/admin` | Admin home + queue |
| GET | `/admin/staff` | Staff performance page |
| GET | `/admin/account` | Admin account details |
| POST | `/tickets/:id/assign` | Assign or reassign staff |
| POST | `/tickets/:id/status` | Admin status transition (cancel/complete path only) |
| POST | `/tickets/:id/comments` | Add comment |

#### Staff Routes
| Method | Route | Purpose |
|---|---|---|
| GET | `/staff` | Assigned queue |
| GET | `/staff/account` | Staff account details |
| POST | `/tickets/:id/status` | Staff status transition |
| POST | `/tickets/:id/comments` | Add comment |

### 7.2 Request/Response Contracts

#### 7.2.1 POST `/login`
Request fields:
- `username` (required)
- `password` (required)

Success:
- Creates session row.
- Sets cookie.
- `303` redirect by role: `/resident`, `/admin`, or `/staff`.

Failure:
- `401` with login page and generic invalid credentials message.

#### 7.2.2 POST `/tickets`
Auth: resident only.

Request fields:
- `csrf_token` (required)
- `issue_type` (`electrical` or `plumbing`)
- `title` (8-120 chars)
- `description` (>=10 chars)

Success:
- Insert ticket + ticket event `created`.
- `303` redirect to `/tickets/:id`.

Failure:
- `422` validation errors with preserved input.
- `409` if flat-level active ticket cap exceeded due race.

#### 7.2.3 POST `/tickets/:id/assign`
Auth: admin of ticket apartment.

Request fields:
- `csrf_token`
- `staff_account_id`

Success:
- Validates active staff-apartment link and staff_type vs issue_type.
- Updates ticket status to `assigned` if currently `open`; keeps `assigned`/`in_progress` on reassign.
- Writes `assigned` or `reassigned` event.
- `303` redirect to `/tickets/:id`.

Failure:
- `404` if ticket not in admin apartment.
- `422` for invalid assignee.
- `409` for stale ticket state.

#### 7.2.4 POST `/tickets/:id/status`
Auth: assigned staff or admin (admin only for cancel/complete path).

Request fields:
- `csrf_token`
- `next_status`
- `cancel_reason` (admin required when completing invalid/duplicate)

Rules:
- Staff allowed: `assigned -> in_progress`, `in_progress -> completed`.
- Admin allowed: `open|assigned|in_progress -> completed` only with cancel reason.

Success:
- Updates status timestamps.
- Writes `status_changed` or `admin_completed_cancel` event.
- `303` redirect `/tickets/:id`.

Failure:
- `409` for invalid transition or stale state.
- `403` for actor transition violation.
- `404` when ticket outside actor visibility policy.

#### 7.2.5 POST `/tickets/:id/comments`
Auth: resident flat account, admin same apartment, or currently assigned staff.

Request fields:
- `csrf_token`
- `comment_text` (1-2000 chars)

Success:
- Insert immutable comment.
- `303` back to `/tickets/:id`.

Failure:
- `422` invalid comment text.
- `409` if ticket already completed (for this MVP).

#### 7.2.6 POST `/tickets/:id/review`
Auth: resident flat account only.

Request fields:
- `csrf_token`
- `rating` (optional 1-5)
- `review_text` (optional)

Rules:
- Ticket must be completed.
- Must not already have review.
- `review_text` is allowed only when `rating` is present.
- Review input decision matrix:

| Case | Rating Provided | Review Text Provided | Allowed | Result |
|---|---|---|---|---|
| 1 | No | No | Yes | Empty review accepted |
| 2 | No | Yes | No | Reject with `422` |
| 3 | Yes | No | Yes | Rating-only review accepted |
| 4 | Yes | Yes | Yes | Rating + text review accepted |

Success:
- Insert review row.
- `303` redirect `/tickets/:id`.

Failure:
- `409` stale or duplicate review.
- `422` invalid input.

### 7.3 Validation Rules
1. Username/password required on login.
2. Ticket title: 8-120 chars.
3. Description: minimum 10 chars.
4. Issue type: enum (`electrical`,`plumbing`).
5. Comment length: 1-2000 chars.
6. Review rating: nullable or integer 1-5.
7. Review text is allowed only when rating is present.
8. Assignment requires active staff link and matching type.
9. Active ticket cap: max 5 for resident.
10. Deactivated accounts cannot authenticate or mutate data.

### 7.4 Error Handling and Status Codes
1. `200` successful page render.
2. `303` successful form mutation redirect.
3. `401` authentication failure at login submit.
4. `403` forbidden action with known resource context.
5. `404` missing route/resource and anti-enumeration on shared ticket route unauthorized access.
6. `409` stale state or invalid transition race.
7. `422` validation failure.
8. `500` unhandled server/database/runtime error.

Error response policy:
1. Always render a usable error page (never blank response).
2. Show verbose error details in UI (`error message`, optional stack in `<pre>`) per project policy.
3. Include recovery links and role-aware navigation.
4. Include request ID on every error page for traceability.

## 8. Authentication, Authorization, and Security
### 8.1 Authentication Flow
1. User submits username/password on `/`.
2. Password verified against stored hash (`bcrypt` compatible hash format).
3. Inactive account rejected.
4. Session token generated, hashed, stored in `sessions`.
5. Cookie set and user redirected to role home.
6. Logout revokes session row and clears cookie.

### 8.2 Session and Cookie Model
- Cookie name: `helpdesk_session`.
- Cookie flags:
- `HttpOnly=true`
- `SameSite=Lax`
- `Path=/`
- `Secure=true` in production HTTPS; local dev may set `Secure=false`.
- Session TTL: 7 days absolute with sliding refresh at activity.
- Session lookup: hash incoming token and compare with `sessions.token_hash`.
- Expired/revoked session: clear cookie and redirect to `/?reason=expired`.

### 8.3 Authorization Matrix
| Action | Resident | Admin | Staff |
|---|---|---|---|
| Create ticket | Yes (self) | No | No |
| View ticket list home | Flat account tickets only | Apartment only | Assigned only |
| View `/tickets/:id` | Flat account tickets only | Same apartment | Currently assigned only |
| Assign/reassign | No | Yes | No |
| Change status | No | Complete-cancel path only | Forward transitions when assigned |
| Add comment | Flat-account ticket | Apartment ticket | Assigned ticket |
| Submit review | Flat-account completed ticket, once | No | No |
| View apartment review text | Yes (own apartment linked staff) | Yes (own apartment linked staff) | No |
| View platform-wide rating counts/avg | No | Yes | No |

### 8.4 CSRF, Input Validation, and SQL Safety
1. CSRF token required on all POST routes.
2. CSRF token generated per session and embedded in form hidden fields.
3. Use only parameterized SQL with placeholders.
4. Never interpolate raw user input into SQL strings.
5. Canonical server-side validation before DB write.
6. Escape/sanitize output in templates to prevent XSS.
7. Password hashes must never be logged.

## 9. Product Behavior by Role
### 9.1 Resident Flows
1. Login redirects to `/resident`.
2. Resident home shows apartment info, active ticket counter, and paginated flat-ticket list.
3. Create ticket available only when flat active tickets <5.
4. Ticket detail includes timeline, comments, assignee details when present.
5. Review form shown only when ticket completed and no prior review.
6. Resident staff ratings page shows only currently linked staff for resident apartment.

### 9.2 Admin Flows
1. Login redirects to `/admin`.
2. Admin home includes KPI cards, aging highlights, and ticket queue with filters.
3. Admin ticket detail allows assign/reassign and comments while ticket active.
4. Admin can close duplicate/invalid tickets by comment + complete action with reason.
5. `/admin/staff` defaults to apartment-specific metrics; platform-wide toggle adds count/avg columns only.

### 9.3 Staff Flows
1. Login redirects to `/staff`.
2. Staff home lists only tickets currently assigned to self.
3. Staff detail allows status movement only to next valid state.
4. Staff can add comments before completion.
5. Staff cannot reassign tickets.

### 9.4 Ticket State Machine and Transition Rules
Allowed statuses:
- `open`
- `assigned`
- `in_progress`
- `completed`

Allowed transitions:
1. `open -> assigned` (admin)
2. `assigned -> in_progress` (assigned staff)
3. `in_progress -> completed` (assigned staff)
4. `open|assigned|in_progress -> completed` (admin with cancellation reason)

Forbidden transitions:
1. Any backward transition.
2. Any resident-driven status transition.
3. Any staff transition when not currently assigned.
4. Any skipped transition by staff.

## 10. UI/UX and Accessibility Requirements
### 10.1 Mobile-First Layout Rules
1. Base width support: 320px.
2. Centered single-column container with max width 480px.
3. No horizontal scroll in primary flows.
4. Large form controls and tap targets.
5. No hover-only controls.

### 10.2 Navigation Standards
1. Every page must include explicit destination links at top.
2. Generic `Back` labels are not allowed.
3. Ticket detail back link text must be role-specific:
- Resident: `<- Resident Home (All Tickets)`
- Admin: `<- Admin Home (All Tickets)`
- Staff: `<- Staff Home (Assigned Tickets)`
4. Error pages must include role-aware home link and retry option for `500`.

### 10.3 Progressive Enhancement Rules
1. Core features must work without JS.
2. JS enhancements must be optional and non-blocking.
3. No client-side routing and no SPA dependency.
4. No JS animation logic.

### 10.4 Accessibility Baseline
1. Semantic headings and landmarks (`main`, `nav`, `form`, `label`).
2. Form fields must have visible labels.
3. Validation messages tied to inputs and shown near fields.
4. Keyboard-accessible navigation and controls.
5. Sufficient color contrast and visible focus states.

## 11. Non-Functional Requirements
### 11.1 Performance Targets
1. First page response under 1-2 seconds on slow network assumptions.
2. Keep HTML payloads lean; avoid large assets and bundles.
3. Keep DB query count low per request; avoid N+1 access patterns.

### 11.2 Reliability and Failure Modes
1. Any unhandled exception must render a graceful error page.
2. Error page must include actionable links.
3. Verbose error details are intentionally shown to user for this hobby project.
4. Session expiry redirects to login with context (`?reason=expired`).
5. Stale form submissions return safe conflict responses.

### 11.3 Cost and Operational Simplicity
1. Single Worker and single D1 database.
2. No paid APIs.
3. No queue/cron dependency for MVP.
4. Accept free-tier limitations.

### 11.4 Observability and Auditability
1. Log one structured entry per request with request ID, actor, route, status, duration.
2. Log all state mutations with ticket ID and actor.
3. Keep append-only event/comment/review records for audit trail.
4. Expose `_health` and `_db` endpoints for basic runtime checks.

## 12. Development Process and Quality Gates
### 12.1 Test-Driven Development Policy (Tests First, Mandatory)
1. For new behavior, write failing test first.
2. Implement minimum code to pass.
3. Refactor while keeping tests green.

### 12.2 Red-Green-Refactor Workflow
1. Red: add/adjust test for expected behavior.
2. Green: implement behavior with simplest correct path.
3. Refactor: improve readability and reduce duplication without behavior change.

### 12.3 Definition of Done
A change is complete only when:
1. Unit/integration/e2e tests for changed behavior pass locally.
2. Authorization and validation edge cases are covered.
3. Graceful failure path tested for key error scenarios.
4. Route behavior documented in spec or inline technical docs.
5. Migration updates included when schema changes.

### 12.4 Code Review Requirements
1. Focus first on authorization leaks, data integrity, and state machine correctness.
2. Verify SQL parameterization and CSRF coverage for all mutations.
3. Confirm no JS dependency introduced for core flows.
4. Verify error pages remain graceful with explicit next actions.

### 12.5 Regression Test Requirements
Mandatory regression sets:
1. Cross-role and cross-apartment access denial tests.
2. Ticket transition legality tests.
3. Single-review enforcement tests.
4. Active-ticket cap tests.
5. Deactivated user login/mutation denial tests.

### 12.6 Coverage and Test Type Expectations
1. Unit tests: pure validation and state transition logic.
2. Integration tests: route + DB interaction for each mutation.
3. End-to-end tests: full browser flows for resident/admin/staff.
4. Responsive UI checks: verify rendering and usability at minimum viewport matrix:
- `320x568`
- `375x812`
- `390x844`
- `768x1024`
- `1280x800`
5. Browser matrix for e2e: Chromium, Firefox, WebKit.
6. Endpoint tests alone are insufficient; e2e front-end-visible behavior tests are mandatory.

## 13. Local-First Development and Manual Release Policy
### 13.1 Local-Only Development Workflow
1. Install dependencies: `npm i`.
2. Apply migrations locally: `npm run migrate:local`.
3. Start local server: `npm run dev`.
4. Run local tests (unit/integration/e2e) before any release action.
5. For commit workflow in this environment, run `git add`, `git commit`, and `git push` directly; no repeated `user.name`/`user.email` overrides or path prefixes are required.

### 13.2 Milestone Test Gate (All Tests Passing Locally)
No milestone is eligible for deploy unless all local test suites pass, including:
1. Core endpoint/integration tests.
2. Role authorization negative cases.
3. End-to-end browser tests with viewport matrix.

### 13.3 Manual Deployment Procedure (No CI/CD)
1. Ensure local tests are green.
2. Apply any required D1 migrations.
3. Deploy manually to Cloudflare via wrangler (`npm run deploy`).
4. Run post-deploy smoke checks.

### 13.4 Pre-Deploy Verification Checklist
1. Working tree reviewed and intended changes only.
2. Migration files present and ordered.
3. All tests green locally.
4. `wrangler.toml` points to correct D1 database.
5. Release notes prepared (high-level behavior + risk points).

### 13.5 Post-Deploy Smoke Checks
1. `/_health/` returns `ok`.
2. `/_db/` confirms schema version.
3. Login works for each role in staging-like test accounts.
4. One resident ticket create and view flow succeeds.
5. One admin assignment and one staff completion flow succeeds.
6. Error page rendering checked with forced error route or test fixture.

### 13.6 Manual Rollback Procedure
1. Identify previous stable git commit.
2. Re-deploy prior code version via wrangler.
3. If migration caused issue, restore DB from backup snapshot.
4. Re-run smoke checks after rollback.

## 14. Deployment and Operations
### 14.1 Environments and Configuration
| Environment | Runtime | DB | Purpose |
|---|---|---|---|
| Local | Node HTTP (`local/dev.mjs`) | SQLite file (`local.db`) | Development and test |
| Production | Cloudflare Worker (`src/index.ts`) | D1 (`DB` binding) | Live hobby deployment |

Recommended config values:
- `SESSION_COOKIE_NAME` (default `helpdesk_session`)
- `SESSION_TTL_HOURS` (default `168`)
- `APP_ENV` (`local` or `production`)
- `LOG_LEVEL` (`info` default)

### 14.2 Local Development Commands
- Install: `npm i`
- Migrate local DB: `npm run migrate:local`
- Start local server: `npm run dev`
- Optional Worker-local run: `npm run dev:cf`

### 14.3 Production Deployment Commands
- Apply D1 migrations: `npm run d1:migrate`
- Deploy Worker: `npm run deploy`

Deployment policy:
1. Production push is direct deploy via Wrangler to Cloudflare.
2. No CI/CD autopush in MVP; deploy is manual and intentional.

### 14.4 Operations Runbook
Common checks:
1. DB connectivity: `/_db/`.
2. Worker liveness: `/_health/`.
3. Session issues: clear cookie, inspect `sessions` expiry/revocation.
4. Assignment failures: verify active `staff_apartment_links` and staff type.
5. Unexpected 500: inspect request ID logs and displayed error payload.

## 15. Risks, Open Questions, and Decisions
### 15.1 Known Risks and Mitigations
1. Risk: authorization regression with shared ticket route.
- Mitigation: explicit policy tests for cross-role and cross-apartment access.
2. Risk: runtime drift between local Node and Worker code paths.
- Mitigation: shared core handler layer and mirrored integration tests.
3. Risk: manual provisioning mistakes.
- Mitigation: operator checklist and DB sanity queries before account activation.
4. Risk: verbose error display may leak internals.
- Mitigation: keep this behavior intentional for hobby mode; avoid embedding secrets in thrown errors.

### 15.2 Open Questions
1. None blocking MVP implementation.
2. Cooldown on resident ticket creation remains deferred until abuse data exists.

### 15.3 Decision Log
1. Decision: Unauthorized access to `/tickets/:id` returns `404` (anti-enumeration), while action-level forbidden in known context returns `403`.
2. Decision: Admin completion of invalid/duplicate tickets requires reason and writes audit event.
3. Decision: `review_text` is allowed only when `rating` is present; empty review submission is valid.
4. Decision: Verbose error details are shown to users by design for this project.

## 16. Delivery Plan
### 16.1 Milestones and Thin Slices
1. Milestone 1: schema expansion + auth/session/CSRF baseline + login routing.
2. Milestone 2: resident create/list/detail/comment flow.
3. Milestone 3: admin queue + assign/reassign + cancellation-complete path.
4. Milestone 4: staff queue + status transitions + review flow.
5. Milestone 5: ratings pages + full regression/e2e matrix + release hardening.

### 16.2 Dependencies
1. Stable schema and migration tooling.
2. Test fixture accounts across all roles/apartments.
3. Shared renderer and route utility helpers.
4. Cloudflare D1 binding correctly configured.

### 16.3 Release Readiness Checklist
1. All route contracts implemented and tested.
2. All role visibility rules verified in negative tests.
3. Ticket state machine fully enforced.
4. Graceful and verbose error handling verified across major failure modes.
5. Manual deploy + smoke checklist completed.

## 17. Appendices
### 17.1 Glossary
- Active ticket: ticket in `open`, `assigned`, or `in_progress`.
- Linked staff: staff with active `staff_apartment_links` row for apartment.
- Platform-wide rating summary: aggregate count/average without cross-apartment review text.

### 17.2 Reference Tables (Routes, Statuses, Roles)
#### Status labels
| DB Value | UI Label |
|---|---|
| `open` | Open |
| `assigned` | Assigned |
| `in_progress` | In Progress |
| `completed` | Completed |

#### Role labels
| DB Value | UI Label |
|---|---|
| `resident` | Resident |
| `admin` | Admin |
| `staff` | Staff |

### 17.3 Future Considerations
1. Notification channel integration.
2. File attachment support.
3. SLA and escalation policies.
4. Per-manager admin accountability model.
5. Optional operator UI for provisioning.
6. Support multiple resident accounts per flat with shared visibility/cap controls.

## 18. Assumptions Made for This Specification
1. Existing PRD/scope conflict on internal error exposure is resolved in favor of this project policy: verbose errors are shown to users.
2. Unauthorized access to shared ticket route (`/tickets/:id`) uses `404` to avoid resource enumeration.
3. Commenting on completed tickets is blocked in MVP for all roles.
4. Ticket number format uses deterministic generated value (implementation can derive from numeric ID with prefix).
5. Session TTL is 7 days with sliding refresh.
6. No resident submission cooldown is implemented in MVP.
7. Migration system will be expanded beyond current single-file bootstrap to versioned ordered migrations with ledger tracking.
8. E2E/browser matrix testing will be introduced even though current repository does not yet include test harness scripts.
9. Development workflow may use direct `git add`, `git commit`, `git push` commands without repeating `user.name`/`user.email` overrides because approved permissions already exist for those command prefixes.
10. Production deployment is always performed via Wrangler directly to Cloudflare and only when needed.
11. `POST /login` is CSRF-exempt for MVP because authentication starts without an existing session; CSRF validation is required for authenticated state-changing POST routes.

### 18.1 Milestone 1 assumptions
1. Milestone 1 schema expansion includes only baseline auth/session entities needed for login and role routing (`apartments`, `accounts`, `residents`, `admins`, `staff`, `sessions`, `schema_migrations`, `meta`), while ticket-domain tables are deferred to later milestones.
2. Any unauthenticated access to protected role-home routes in Milestone 1 is treated as an invalid session and redirected to `/?reason=expired`.
3. Milestone 1 role home pages are intentionally thin placeholders that provide navigation and authenticated logout with CSRF, with full product workflows deferred to later milestones.
4. The public login page (`GET /`) uses the page title and heading `Helpdesk` and does not render a self-referential top navigation link back to `/`.
5. On Resident Home in Milestone 1, `Create Ticket` is rendered as a primary action button (outside top navigation), while top navigation contains link-style navigation destinations only.
6. On role home pages in Milestone 1, `Logout` is rendered as a compact button in the top navigation area (left-aligned), and resident navigation label `Resident Account` is shortened to `Profile`.
7. On Admin Home in Milestone 1, apartment and flat context is shown explicitly (`Flat` displayed as `N/A (Admin account)`), and admin navigation label `Admin Account` is shortened to `Profile`.
