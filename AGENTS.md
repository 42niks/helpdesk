# Project Agent Rules

## Closeout Protocol
When the user says `run closeout protocol`, perform these steps in order:
1. Update any and all relevant documentation for the work currently done.
2. Commit and push.
3. If local dev DB data changed, sync those changes to Cloudflare D1 so remote mirrors local dev DB, excluding the `sessions` table.
4. Deploy code to Cloudflare.

## Working Style
- If a request has more than 2 tasks, create and maintain a todo list while executing.
