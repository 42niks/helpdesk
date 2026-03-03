import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";

import { applyMigrations } from "../../src/app/migrations.mjs";

function nowIso() {
  return new Date().toISOString();
}

const sqlitePath = process.env.E2E_SQLITE_PATH || path.resolve(process.cwd(), ".tmp/e2e.db");
const tmpDir = path.dirname(sqlitePath);
fs.mkdirSync(tmpDir, { recursive: true });
if (fs.existsSync(sqlitePath)) {
  fs.rmSync(sqlitePath, { force: true });
}

applyMigrations({
  sqlitePath,
  migrationsDir: path.resolve(process.cwd(), "migrations"),
});

const db = new DatabaseSync(sqlitePath);
db.exec("PRAGMA foreign_keys = ON");

const createdAt = nowIso();
db.prepare(
  "insert into apartments (name, code, is_active, created_at, updated_at) values (?, ?, 1, ?, ?)",
).run("Palm Meadows", "PM", createdAt, createdAt);
const apartmentId = db.prepare("select id from apartments where code = ?").get("PM").id;

const passwordHash = bcrypt.hashSync("password123", 10);
const insertAccount = db.prepare(
  "insert into accounts (username, password_hash, role, is_active, created_at, updated_at) values (?, ?, ?, 1, ?, ?)",
);
insertAccount.run("resident_flat101", passwordHash, "resident", createdAt, createdAt);
insertAccount.run("resident_flat102", passwordHash, "resident", createdAt, createdAt);
insertAccount.run("admin_pm", passwordHash, "admin", createdAt, createdAt);
insertAccount.run("staff_electric_1", passwordHash, "staff", createdAt, createdAt);
insertAccount.run("staff_plumber_1", passwordHash, "staff", createdAt, createdAt);

const residentAccountId = db.prepare("select id from accounts where username = ?").get("resident_flat101").id;
const residentFlat102AccountId = db.prepare("select id from accounts where username = ?").get("resident_flat102").id;
const adminAccountId = db.prepare("select id from accounts where username = ?").get("admin_pm").id;
const staffAccountId = db.prepare("select id from accounts where username = ?").get("staff_electric_1").id;
const staffPlumberAccountId = db.prepare("select id from accounts where username = ?").get("staff_plumber_1").id;

db.prepare(
  [
    "insert into residents (account_id, apartment_id, full_name, flat_number, mobile_number, created_at, updated_at)",
    "values (?, ?, ?, ?, ?, ?, ?)",
  ].join(" "),
).run(residentAccountId, apartmentId, "Flat 101", "101", "9999999999", createdAt, createdAt);
db.prepare(
  [
    "insert into residents (account_id, apartment_id, full_name, flat_number, mobile_number, created_at, updated_at)",
    "values (?, ?, ?, ?, ?, ?, ?)",
  ].join(" "),
).run(residentFlat102AccountId, apartmentId, "Flat 102", "102", "9999999998", createdAt, createdAt);

db.prepare(
  [
    "insert into admins (account_id, apartment_id, display_name, mobile_number, is_shared_account, created_at, updated_at)",
    "values (?, ?, ?, ?, 1, ?, ?)",
  ].join(" "),
).run(adminAccountId, apartmentId, "Palm Meadows Admin", "8888888888", createdAt, createdAt);

db.prepare(
  "insert into staff (account_id, full_name, mobile_number, staff_type, created_at, updated_at) values (?, ?, ?, ?, ?, ?)",
).run(staffAccountId, "Electric Staff", "7777777777", "electrician", createdAt, createdAt);

db.prepare(
  "insert into staff (account_id, full_name, mobile_number, staff_type, created_at, updated_at) values (?, ?, ?, ?, ?, ?)",
).run(staffPlumberAccountId, "Plumber Staff", "7777777776", "plumber", createdAt, createdAt);

db.prepare(
  [
    "insert into staff_apartment_links (staff_account_id, apartment_id, is_active, linked_at, unlinked_at)",
    "values (?, ?, 1, ?, null)",
  ].join(" "),
).run(staffAccountId, apartmentId, createdAt);

db.prepare(
  [
    "insert into staff_apartment_links (staff_account_id, apartment_id, is_active, linked_at, unlinked_at)",
    "values (?, ?, 1, ?, null)",
  ].join(" "),
).run(staffPlumberAccountId, apartmentId, createdAt);

db.close();

console.log(`ok: e2e fixture database ready at ${sqlitePath}`);
