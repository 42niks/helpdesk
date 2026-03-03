# Milestone 1

## Unit tests

1. **Session token generation test**
Checks that creating a session token returns a real string token and not an empty value.

2. **Session token hash test**
Checks that hashing the same token gives the same result every time, and that the hash is not the raw token itself.

## Integration tests (backend + database)

1. **Migration baseline test**
Checks that required auth/session baseline tables exist and `schema_version` remains compatible with Milestone 1 expectations.

2. **Login page render test**
Checks that `GET /` shows the login form fields and that `/?reason=expired` shows a session-expired message.

3. **Role-based login routing test**
Checks that valid login redirects correctly:
- resident -> `/resident`
- admin -> `/admin`
- staff -> `/staff`
Also checks that the session cookie is set with expected security flags (`HttpOnly`, `SameSite=Lax`, `Path=/`).

4. **Invalid credentials test**
Checks that wrong password login fails with `401` and shows a generic invalid credentials error.

5. **Protected route auth + role guard test**
Checks that:
- unauthenticated access to a protected route redirects to `/?reason=expired`
- correct role can access its home page
- wrong role gets `403` with role-aware navigation text

6. **Expired session handling test**
Checks that expired sessions are rejected, cookie is cleared, and user is redirected to `/?reason=expired`.

7. **Logout CSRF enforcement test**
Checks that logout fails with `403` when CSRF token is missing, and succeeds when token is valid (session revoked + cookie cleared + redirect to `/?reason=logged_out`).

## E2E tests (frontend/browser)

1. **Resident login and logout flow**
In a real browser, checks resident can:
- open homepage
- submit login form
- reach resident home
- logout and return to login with logged-out banner

2. **Admin and staff login routing flow**
In a real browser, checks admin login lands on admin home, and staff login lands on staff home.

# Milestone 2

## Unit tests

1. **Ticket create validation test**
Checks valid resident ticket input passes and invalid issue/title/description combinations fail with expected messages.

2. **Ticket comment validation test**
Checks comment text is trimmed and validated within 1-2000 character limits.

## Integration tests (backend + database)

1. **Milestone 2 migration test**
Checks ticket-domain resident tables exist (`tickets`, `ticket_events`, `ticket_comments`) and `schema_version=3`.

2. **Resident home list rendering test**
Checks resident home shows active count and resident-owned tickets with detail links.

3. **Resident ticket create success test**
Checks `POST /tickets` creates an `open` ticket, assigns deterministic ticket number format, and records `created` event.

4. **Resident ticket create validation test**
Checks invalid create input returns `422` with field errors and preserved values.

5. **Resident active cap test**
Checks resident ticket create is blocked with `409` when flat has 5 active tickets.

6. **Resident ticket detail authorization test**
Checks non-owner resident receives `404` on `/tickets/:id`.

7. **Resident comment success test**
Checks owner can post comment via `/tickets/:id/comments`, gets `303`, and comment appears in detail timeline.

8. **Resident comment validation test**
Checks invalid comment input returns `422` with inline error.

9. **Resident completed-ticket comment block test**
Checks comment on completed ticket returns `409`.

10. **Resident mutation CSRF test**
Checks missing CSRF on `POST /tickets` and `POST /tickets/:id/comments` returns `403`.

## E2E tests (frontend/browser)

1. **Resident create and comment flow**
In a real browser, checks resident can login, create a ticket from `/tickets/new`, land on `/tickets/:id`, submit comment, and see ticket on resident home list.

# Milestone 3-5

## Integration tests (backend + database)

1. **Milestone 3+ migration test**
Checks `staff_apartment_links` and `ticket_reviews` tables exist and schema version is updated.

2. **Admin assignment success test**
Checks admin can assign an eligible linked staff member and assignment event is recorded.

3. **Admin assignment validation tests**
Checks assignment is rejected for staff type mismatch and unlinked staff.

4. **Shared ticket detail visibility test**
Checks `/tickets/:id` visibility for resident owner, admin apartment, and currently assigned staff; non-visible actors get `404`.

5. **Staff status transition tests**
Checks valid transitions (`assigned -> in_progress -> completed`) and rejects invalid transitions with `409`.

6. **Admin completion with cancellation reason test**
Checks admin completion requires reason, sets admin-cancel flag, and writes event + comment trail.

7. **Resident review flow tests**
Checks resident can submit review once on completed ticket, duplicate review returns `409`, and review text without rating returns `422`.

8. **Ratings scope test**
Checks resident/admin apartment ratings are apartment-scoped (including review text) and admin platform view shows only summary metrics.

## E2E tests (frontend/browser)

1. **Full cross-role workflow**
In a real browser, checks resident ticket creation, admin assignment, staff completion, resident review submission, and resident staff-ratings visibility.
