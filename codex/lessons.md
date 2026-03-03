# Codex Lessons

## Collaboration Preferences
- Follow instructions exactly and avoid adding extra work the user did not ask for.
- Confirm unclear requirements before coding when asked to pause.
- Keep responses concise and direct; avoid fluff.
- When there is a spec conflict, treat `tech_spec.md` as source of truth.

## Delivery Workflow
- Use strict TDD: write failing tests first, implement minimal code, then refactor.
- Build and validate backend first.
- Ensure E2E tests validate front-end-visible behavior.
- Do not deploy unless explicitly asked.

## Local Environment Conventions
- `npm run dev` should default to `local-dev-db` for user manual testing.
- Coding/test-focused local workflows should use `local-test-db` via explicit test-db scripts.
- Keep demo seed scripts and local DB files out of git.

## Cloudflare/D1 Ops Notes
- For remote DB changes, use `--remote` explicitly with Wrangler D1 commands.
- Remote D1 import through Wrangler should avoid explicit SQL `BEGIN/COMMIT` in seed files.
- Validate deployment with `/_health/` and `/_db/` checks after deploy.
