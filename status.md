# Apartment Helpdesk: Current Status

Last updated: 2026-03-03

## 1. Overall Project Health
1. Scope status: MVP milestones 1-5 are implemented.
2. Delivery status: Core backend, SSR UI, migrations, and test coverage are in place.
3. Runtime status: Works in local Node+SQLite and production Worker+D1 modes.
4. Stability status: Main user workflows are covered by backend integration and frontend e2e tests.
5. Current focus shift: Codebase readability and maintainability were improved via modular app + test refactor.

## 2. What Has Been Delivered
1. Role-based authentication with bcrypt password verification.
2. Server-side session management with token hashing and sliding expiry.
3. CSRF protection for authenticated POST mutations.
4. Role-aware home routes for resident, admin, and staff.
5. Resident ticket creation with validations and active ticket cap.
6. Resident ticket list/detail with timeline and comments.
7. Shared `/tickets/:id` detail route with strict visibility checks.
8. Admin assignment and reassignment with staff-apartment link validation.
9. Admin completion flow requiring cancellation reason and audit trail.
10. Staff status transitions (`assigned -> in_progress -> completed`) with transition enforcement.
11. Resident review submission with rating/text validation and duplicate prevention.
12. Resident ratings page scoped to apartment-linked staff.
13. Admin staff performance page with apartment and platform summary modes.
14. Request and mutation structured logging with request IDs.
15. Explicit error routes (`/403`, `/404`, `/500`) with role-aware navigation.

## 3. Architecture and Refactor Status
1. App entrypoint is now thin and route-focused.
2. `src/app` is now domain-organized instead of flat.
3. `src/app/auth/` contains security, session, and guard concerns.
4. `src/app/core/` contains shared data access, utils, and server-rendered view helpers.
5. `src/app/tickets/` contains ticket validations and ticket flow handlers.
6. `src/app/pages/` contains resident/admin/staff page-level handlers.
7. `src/app/errors/` centralizes logout + error page responses.
8. `src/app/db/` contains runtime-specific adapters (Node, D1).
9. Error/forbidden/not-found/server-error handling is centralized and reused.
10. Result: no code file exceeds 1000 lines; code ownership boundaries are clearer.

## 4. Database and Migration Status
1. Migration framework supports ordered SQL migration execution with tracking table.
2. Implemented migrations:
- `0001_init.sql`
- `0002_milestone1_auth_baseline.sql`
- `0003_milestone2_resident_tickets.sql`
- `0004_milestone3_workflows_reviews.sql`
3. Milestone 4/5 features currently reuse schema introduced by migration 0004.
4. Current schema version reported by app health check: `4`.

## 5. Test Suite Status
1. Test suite was reorganized for clarity and predictability.
2. New test layout:
- `tests/backend/unit/`
- `tests/backend/integration/`
- `tests/frontend/e2e/specs/`
- `tests/frontend/e2e/setup/`
3. File naming now removes redundant labels already conveyed by folder path.
4. Milestone-driven naming is retained for quick traceability.
5. Inventory is maintained in lowercase: `tests/test_inventory.md`.
6. Current declaration counts:
- Backend unit + integration: 48
- Frontend e2e declarations: 4
- E2E matrix executions per full run: 60
7. Latest verification:
- `npm test` passing
- `npx playwright test --list` confirms expected e2e discovery matrix

## 6. Deployment and Ops Status
1. Cloudflare deployment path is configured and has been exercised.
2. D1 migration flow is available through npm scripts.
3. Local dev scripts exist for migrate/seed/dev loops.
4. Health endpoints available:
- `/_health/`
- `/_db/`

## 7. Readability and Manageability Improvements Completed
1. App logic split into domain folders (`auth`, `core`, `tickets`, `pages`, `errors`, `db`).
2. Routing orchestration simplified and easier to reason about.
3. Test file naming standardized to reduce ambiguity.
4. Test folders encode stack/test-level clearly, so filenames avoid redundancy.
5. Inventory document is maintained as lowercase `tests/test_inventory.md`.

## 8. Known Gaps / Follow-Ups
1. Milestone labels in some legacy test titles still say `milestone 3+`; functionality is covered but wording can be normalized further.
2. No separate migration `0005` exists because Milestone 5 currently did not require new schema changes.
3. Additional hardening could include stricter CI gates and automated inventory drift checks.
4. Optional cleanup: normalize all test titles to include milestone tags in output for faster CI scanning.

## 9. Current Repository State Summary
1. Core workflows are implemented and tested end-to-end.
2. Code is now modular enough for safer incremental changes.
3. Test organization is significantly clearer than the earlier flat structure.
4. Project is in a stable state for iteration on UX, operations, or next-feature scope.
