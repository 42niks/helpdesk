import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

function migrationFiles(migrationsDir) {
  return fs
    .readdirSync(migrationsDir)
    .filter((fileName) => /^\d+.*\.sql$/i.test(fileName))
    .sort((a, b) => a.localeCompare(b));
}

export function applyMigrations({ sqlitePath, migrationsDir }) {
  const db = new DatabaseSync(sqlitePath);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(
    [
      "create table if not exists schema_migrations (",
      "  version text primary key,",
      "  applied_at text not null",
      ")",
    ].join("\n"),
  );

  const existingRows = db.prepare("select version from schema_migrations").all();
  const appliedVersions = new Set(existingRows.map((row) => row.version));
  const appliedNow = [];

  for (const fileName of migrationFiles(migrationsDir)) {
    if (appliedVersions.has(fileName)) {
      continue;
    }

    const sql = fs.readFileSync(path.resolve(migrationsDir, fileName), "utf8");
    const appliedAt = new Date().toISOString();
    db.exec("begin");
    try {
      db.exec(sql);
      db.prepare("insert into schema_migrations (version, applied_at) values (?, ?)").run(fileName, appliedAt);
      db.exec("commit");
      appliedNow.push(fileName);
    } catch (error) {
      db.exec("rollback");
      throw error;
    }
  }

  db.close();
  return appliedNow;
}
