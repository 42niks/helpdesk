# Remote D1 Ops

Use the safe wrappers from the repo root:

```bash
npm run d1:remote:preflight
npm run d1:remote:exec -- "select value from meta where key='schema_version';"
npm run d1:remote:import -- /Users/nikhiltr/helpdesk/local/overwrite_remote_from_local_dev_db.sql
```

Data sync note:

- `overwrite_remote_from_local_dev_db.sql` and `.notx.sql` mirror `local-dev-db` demo data.
- They intentionally clear remote `sessions` and do not insert session rows.
- Regenerate these files after reseeding `local-dev-db` before remote import.

Rules:

- Always run remote commands with `--remote` (handled by wrappers).
- Do not use explicit SQL transaction statements (`BEGIN`, `COMMIT`, `SAVEPOINT`, `RELEASE`, `ROLLBACK`) in remote import files.
- `d1:remote:import` strips those statements automatically before import.
- Prefer `d1:remote:exec` and `d1:remote:import` over raw `wrangler d1 execute` for consistency.
