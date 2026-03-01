import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const sqlitePath = process.env.SQLITE_PATH || "local.db";
const migrationsPath = path.resolve(process.cwd(), "migrations", "0001_init.sql");

const sql = fs.readFileSync(migrationsPath, "utf8");
const db = new DatabaseSync(sqlitePath);

db.exec(sql);
db.close();

console.log(`ok: applied migrations to ${sqlitePath}`);

