# Milestone 1

## Unit tests

1. **Session token generation test**
Checks that creating a session token returns a real string token and not an empty value.

2. **Session token hash test**
Checks that hashing the same token gives the same result every time, and that the hash is not the raw token itself.

## Integration tests (backend + database)

1. **Migration baseline test**
Checks that Milestone 1 migrations create the required auth/session tables and set `schema_version=2`.

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
