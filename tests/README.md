# Test Layout

Folder structure carries stack and test level. Filenames focus on milestone + scenario.

## Directory Map

- `tests/backend/unit/`
- `tests/backend/integration/`
- `tests/frontend/e2e/specs/`
- `tests/frontend/e2e/setup/`

## Filename Convention

Format:

`m<milestone>_<scope>.test.mjs`
`m<milestone>_<scope>.spec.mjs`

Examples:

- `m1_auth_sessions.test.mjs`
- `m4_staff_status_review_flow.test.mjs`
- `m5_cross_role_lifecycle.spec.mjs`

Notes:

- Helper files live in `tests/backend/integration/helpers/`.
- E2E database setup lives in `tests/frontend/e2e/setup/backend_seed.mjs`.
