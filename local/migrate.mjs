import path from "node:path";
import { applyMigrations } from "../src/app/migrations.mjs";

const sqlitePath = process.env.SQLITE_PATH || "local-dev-db";
const migrationsDir = path.resolve(process.cwd(), "migrations");

const applied = applyMigrations({
  sqlitePath,
  migrationsDir,
});

console.log(`ok: applied ${applied.length} migration(s) to ${sqlitePath}`);
