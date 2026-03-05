# Test Inventory

## Backend Unit Tests (8)

### `tests/backend/unit/m1_security_auth.test.mjs` (2)
1. `createSessionToken returns a non-empty token`
2. `hashSessionToken is deterministic and not raw token`

### `tests/backend/unit/m2_m4_ticket_input_validation.test.mjs` (6)
1. `validateTicketCreateInput accepts valid ticket input`
2. `validateTicketCreateInput rejects invalid issue type and short fields`
3. `validateCommentInput accepts and trims comment text`
4. `validateCommentInput rejects empty and overlong comments`
5. `validateReviewInput accepts rating-only and rating+text combinations`
6. `validateReviewInput rejects missing rating and invalid rating`

## Backend Integration Tests (41)

### `tests/backend/integration/m1_auth_sessions.test.mjs` (7)
1. `milestone 1 migration creates auth/session baseline tables`
2. `GET / renders login page and session-expired banner`
3. `POST /login routes by role and sets secure session cookie baseline`
4. `POST /login rejects invalid credentials`
5. `protected route requires valid session and role`
6. `expired session is cleared and redirected to session-expired login`
7. `POST /logout enforces CSRF for authenticated session`

### `tests/backend/integration/m2_resident_tickets.test.mjs` (10)
1. `milestone 2 migration creates ticket tables and updates schema version`
2. `resident home shows active ticket count and resident ticket list`
3. `POST /tickets creates resident ticket and created event`
4. `POST /tickets returns 422 with validation errors`
5. `POST /tickets returns 409 when active ticket limit is reached`
6. `GET /tickets/:id returns 404 for resident not owning the ticket`
7. `POST /tickets/:id/comments creates ticket comment for resident owner`
8. `POST /tickets/:id/comments returns 422 for invalid comment input`
9. `POST /tickets/:id/comments returns 409 for completed ticket`
10. `resident ticket mutations enforce CSRF tokens`

### `tests/backend/integration/m3_admin_assignment_queue.test.mjs` (9)
1. `milestone 4+ migration adds staff apartment links and schema advances`
2. `admin can assign linked and matching staff to an open ticket`
3. `admin can reassign ticket while status is assigned`
4. `admin can reassign ticket while status is in_progress`
5. `admin assignment rejects type mismatch and unlinked staff`
6. `shared ticket detail visibility: resident owner, admin apartment, assigned staff`
7. `admin completion requires cancel reason and records audit trail`
8. `admin can complete assigned and in_progress tickets with cancellation reason`
9. `admin home supports queue filters, pagination, and aging highlights`

### `tests/backend/integration/m4_staff_status_review_flow.test.mjs` (10)
1. `admin and assigned staff can add comments while ticket is active`
2. `admin and assigned staff comments are blocked after ticket completion`
3. `non-assigned staff gets 404 for comment and status mutations`
4. `staff can progress assigned ticket to in_progress and completed`
5. `staff invalid status transition returns 409`
6. `resident review submission supports rating and text and blocks duplicates`
7. `resident review requires rating and accepts rating-only review`
8. `resident review without rating returns 422`
9. `resident review is blocked until ticket is completed`
10. `submitted review appears on admin and assigned staff ticket detail`

### `tests/backend/integration/m5_ratings_observability_regression.test.mjs` (5)
1. `milestone 5 migration adds ticket reviews table and schema advances`
2. `full workflow: resident create, admin assign, staff comment+complete, resident review, rating visible`
3. `resident ratings summary/detail and admin ratings pages show scoped data`
4. `GET /500 renders role-aware home link and retry option`
5. `request and mutation logging emit structured records`

## Frontend E2E Specs (4)

### `tests/frontend/e2e/specs/m1_auth_and_role_routing.spec.mjs` (2)
1. `resident can login from homepage and logout`
2. `admin and staff are routed to their role homes`

### `tests/frontend/e2e/specs/m2_resident_ticket_comment_flow.spec.mjs` (1)
1. `resident can create a ticket and add a comment from ticket detail`

### `tests/frontend/e2e/specs/m5_cross_role_lifecycle.spec.mjs` (1)
1. `admin assignment, staff completion, and resident review flow`

## Frontend E2E Setup

- `tests/frontend/e2e/setup/backend_seed.mjs`
- `tests/frontend/e2e/setup/d1_seed.sql`

## Totals

1. Backend unit + integration declarations: `49`
2. Frontend e2e declarations: `4`
3. All declarations combined: `53`
