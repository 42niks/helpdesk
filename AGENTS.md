# Project Agent Rules

- Be as less verbose as possible. User will also talk in few words.
- Always keep documentation up to date. If I ask you to commit and push, if the documentation is not up to date, then remind me to ask you to update documentation first and then to commit and push.

## Collaboration Preferences
- Follow instructions exactly and avoid adding extra work the user did not ask for.
- Confirm unclear requirements before coding when asked to pause.
- Keep responses concise and direct; avoid fluff.
- When there is a spec conflict, treat `tech_spec.md` as source of truth.
- When working on more than 2 tasks in one request, create a todo list and keep it updated as items are completed.

## Delivery Workflow
- Use strict TDD: write failing tests first, implement minimal code, then refactor.
- Build and validate backend first, unless you are working on UI revamp.
- Ensure E2E tests validate front-end-visible behavior.
- Do not deploy unless explicitly asked.
- Tests should always be strengthened and not weakened. They can be deleted if there is a good reason for doing so.
- Tests can be strengthened by making them more generic or adding more specific tests to cover all cases.

## Local Environment Conventions
- `npm run dev` should default to `local-dev-db` for user manual testing.
- Coding/test-focused local workflows should use `local-test-db` via explicit test-db scripts.
- Keep demo seed scripts and local DB files out of git.

## Cloudflare/D1 Ops Notes
- Before any remote D1 operation, read this lessons file first and run `npm run d1:remote:preflight`.
- For remote DB changes, use `--remote` explicitly with Wrangler D1 commands.
- Remote D1 import through Wrangler should avoid explicit SQL `BEGIN/COMMIT` in seed files.
- Validate deployment with `/_health/` and `/_db/` checks after deploy.

## Closeout Protocol
When the user says `run closeout protocol`, perform these steps in order:
1. Update any and all relevant documentation for the work currently done.
2. Commit and push.
3. If local dev DB data changed, sync those changes to Cloudflare D1 so remote mirrors local dev DB, excluding the `sessions` table.
4. Deploy code to Cloudflare.
