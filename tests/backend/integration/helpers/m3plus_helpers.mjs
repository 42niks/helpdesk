import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";

import { createApp } from "../../../../src/app/index.mjs";
import { createNodeDbAdapter } from "../../../../src/app/db/node-adapter.mjs";
import { applyMigrations } from "../../../../src/app/migrations.mjs";

export function nowIso() {
  return new Date().toISOString();
}

export function hoursAgoIso(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export function buildFormRequest(url, fields, cookie) {
  const headers = {
    "content-type": "application/x-www-form-urlencoded",
  };
  if (cookie) {
    headers.cookie = cookie;
  }
  return new Request(url, {
    method: "POST",
    headers,
    body: new URLSearchParams(fields),
  });
}

export function extractCookiePair(setCookie) {
  assert.ok(setCookie, "missing Set-Cookie");
  return setCookie.split(";")[0];
}

export function extractCsrfToken(html) {
  const match = html.match(/name="csrf_token"\s+value="([^"]+)"/i);
  assert.ok(match, "missing csrf_token hidden input");
  return match[1];
}

export function extractTicketIdFromLocation(locationHeader) {
  assert.ok(locationHeader, "missing redirect location");
  const match = locationHeader.match(/\/tickets\/(\d+)$/);
  assert.ok(match, "redirect location does not include ticket id");
  return Number.parseInt(match[1], 10);
}

export function createFixtureDb() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "helpdesk-m3-"));
  const sqlitePath = path.join(tmpDir, "test.db");

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
  db.prepare(
    "insert into apartments (name, code, is_active, created_at, updated_at) values (?, ?, 1, ?, ?)",
  ).run("Lake View", "LV", createdAt, createdAt);

  const apartmentPalmId = db.prepare("select id from apartments where code = ?").get("PM").id;
  const apartmentLakeId = db.prepare("select id from apartments where code = ?").get("LV").id;

  const passwordHash = bcrypt.hashSync("password123", 10);
  const insertAccount = db.prepare(
    "insert into accounts (username, password_hash, role, is_active, created_at, updated_at) values (?, ?, ?, 1, ?, ?)",
  );

  insertAccount.run("resident_flat101", passwordHash, "resident", createdAt, createdAt);
  insertAccount.run("resident_flat102", passwordHash, "resident", createdAt, createdAt);
  insertAccount.run("resident_lv201", passwordHash, "resident", createdAt, createdAt);
  insertAccount.run("admin_pm", passwordHash, "admin", createdAt, createdAt);
  insertAccount.run("admin_lv", passwordHash, "admin", createdAt, createdAt);
  insertAccount.run("staff_electric_1", passwordHash, "staff", createdAt, createdAt);
  insertAccount.run("staff_plumber_1", passwordHash, "staff", createdAt, createdAt);
  insertAccount.run("staff_electric_2", passwordHash, "staff", createdAt, createdAt);

  const resident101AccountId = db.prepare("select id from accounts where username = ?").get("resident_flat101").id;
  const resident102AccountId = db.prepare("select id from accounts where username = ?").get("resident_flat102").id;
  const residentLv201AccountId = db.prepare("select id from accounts where username = ?").get("resident_lv201").id;
  const adminPalmAccountId = db.prepare("select id from accounts where username = ?").get("admin_pm").id;
  const adminLakeAccountId = db.prepare("select id from accounts where username = ?").get("admin_lv").id;
  const staffElectric1AccountId = db.prepare("select id from accounts where username = ?").get("staff_electric_1").id;
  const staffPlumber1AccountId = db.prepare("select id from accounts where username = ?").get("staff_plumber_1").id;
  const staffElectric2AccountId = db.prepare("select id from accounts where username = ?").get("staff_electric_2").id;

  db.prepare(
    [
      "insert into residents (account_id, apartment_id, full_name, flat_number, mobile_number, created_at, updated_at)",
      "values (?, ?, ?, ?, ?, ?, ?)",
    ].join(" "),
  ).run(resident101AccountId, apartmentPalmId, "Flat 101", "101", "9999999999", createdAt, createdAt);

  db.prepare(
    [
      "insert into residents (account_id, apartment_id, full_name, flat_number, mobile_number, created_at, updated_at)",
      "values (?, ?, ?, ?, ?, ?, ?)",
    ].join(" "),
  ).run(resident102AccountId, apartmentPalmId, "Flat 102", "102", "9999999998", createdAt, createdAt);

  db.prepare(
    [
      "insert into residents (account_id, apartment_id, full_name, flat_number, mobile_number, created_at, updated_at)",
      "values (?, ?, ?, ?, ?, ?, ?)",
    ].join(" "),
  ).run(residentLv201AccountId, apartmentLakeId, "Flat 201", "201", "9999999997", createdAt, createdAt);

  db.prepare(
    [
      "insert into admins (account_id, apartment_id, display_name, mobile_number, is_shared_account, created_at, updated_at)",
      "values (?, ?, ?, ?, 1, ?, ?)",
    ].join(" "),
  ).run(adminPalmAccountId, apartmentPalmId, "Palm Admin", "8888888888", createdAt, createdAt);

  db.prepare(
    [
      "insert into admins (account_id, apartment_id, display_name, mobile_number, is_shared_account, created_at, updated_at)",
      "values (?, ?, ?, ?, 1, ?, ?)",
    ].join(" "),
  ).run(adminLakeAccountId, apartmentLakeId, "Lake Admin", "8888888887", createdAt, createdAt);

  db.prepare(
    "insert into staff (account_id, full_name, mobile_number, staff_type, created_at, updated_at) values (?, ?, ?, ?, ?, ?)",
  ).run(staffElectric1AccountId, "Electric Staff One", "7777777777", "electrician", createdAt, createdAt);

  db.prepare(
    "insert into staff (account_id, full_name, mobile_number, staff_type, created_at, updated_at) values (?, ?, ?, ?, ?, ?)",
  ).run(staffPlumber1AccountId, "Plumber Staff One", "7777777776", "plumber", createdAt, createdAt);

  db.prepare(
    "insert into staff (account_id, full_name, mobile_number, staff_type, created_at, updated_at) values (?, ?, ?, ?, ?, ?)",
  ).run(staffElectric2AccountId, "Electric Staff Two", "7777777775", "electrician", createdAt, createdAt);

  db.prepare(
    [
      "insert into staff_apartment_links (staff_account_id, apartment_id, is_active, linked_at, unlinked_at)",
      "values (?, ?, 1, ?, null)",
    ].join(" "),
  ).run(staffElectric1AccountId, apartmentPalmId, createdAt);

  db.prepare(
    [
      "insert into staff_apartment_links (staff_account_id, apartment_id, is_active, linked_at, unlinked_at)",
      "values (?, ?, 1, ?, null)",
    ].join(" "),
  ).run(staffPlumber1AccountId, apartmentPalmId, createdAt);

  db.prepare(
    [
      "insert into staff_apartment_links (staff_account_id, apartment_id, is_active, linked_at, unlinked_at)",
      "values (?, ?, 1, ?, null)",
    ].join(" "),
  ).run(staffElectric2AccountId, apartmentLakeId, createdAt);

  db.close();

  return {
    sqlitePath,
    apartmentPalmId,
    apartmentLakeId,
    resident101AccountId,
    resident102AccountId,
    residentLv201AccountId,
    adminPalmAccountId,
    adminLakeAccountId,
    staffElectric1AccountId,
    staffPlumber1AccountId,
    staffElectric2AccountId,
    cleanup() {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}

export function createFixtureApp(sqlitePath) {
  const db = createNodeDbAdapter(sqlitePath);
  const app = createApp({
    db,
    environment: "local",
  });

  return {
    app,
    close() {
      db.close();
    },
  };
}

export async function loginAndSession(app, username, roleHomePath) {
  const loginResponse = await app.fetch(
    buildFormRequest("http://helpdesk.local/login", {
      username,
      password: "password123",
    }),
  );
  assert.equal(loginResponse.status, 303);
  assert.equal(loginResponse.headers.get("location"), roleHomePath);

  const cookiePair = extractCookiePair(loginResponse.headers.get("set-cookie"));
  const homeResponse = await app.fetch(
    new Request(`http://helpdesk.local${roleHomePath}`, {
      headers: { cookie: cookiePair },
    }),
  );
  assert.equal(homeResponse.status, 200);
  const homeHtml = await homeResponse.text();
  const csrfToken = extractCsrfToken(homeHtml);

  return {
    cookiePair,
    csrfToken,
  };
}

export function insertTicket({
  sqlitePath,
  apartmentId,
  residentAccountId,
  flatNumber,
  ticketNumber,
  issueType = "electrical",
  title = "Bedroom switch not working",
  description = "The bedroom switch is sparking and needs service.",
  status = "open",
  assignedStaffAccountId = null,
  createdAt = nowIso(),
  updatedAt = null,
  assignedAt = undefined,
  inProgressAt = undefined,
  completedAt = undefined,
}) {
  const db = new DatabaseSync(sqlitePath);
  const resolvedUpdatedAt = updatedAt || createdAt;
  const resolvedAssignedAt = assignedAt !== undefined
    ? assignedAt
    : (status === "assigned" || status === "in_progress" || status === "completed")
      ? createdAt
      : null;
  const resolvedInProgressAt = inProgressAt !== undefined
    ? inProgressAt
    : (status === "in_progress" || status === "completed")
      ? createdAt
      : null;
  const resolvedCompletedAt = completedAt !== undefined
    ? completedAt
    : status === "completed"
      ? createdAt
      : null;

  db.prepare(
    [
      "insert into tickets",
      "(ticket_number, apartment_id, resident_account_id, resident_flat_snapshot, issue_type, title, description, status,",
      "assigned_staff_account_id, created_at, updated_at, assigned_at, in_progress_at, completed_at, completed_by_admin_cancel)",
      "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)",
    ].join(" "),
  ).run(
    ticketNumber,
    apartmentId,
    residentAccountId,
    flatNumber,
    issueType,
    title,
    description,
    status,
    assignedStaffAccountId,
    createdAt,
    resolvedUpdatedAt,
    resolvedAssignedAt,
    resolvedInProgressAt,
    resolvedCompletedAt,
  );

  const ticketId = db.prepare("select id from tickets where ticket_number = ?").get(ticketNumber).id;

  db.prepare(
    [
      "insert into ticket_events",
      "(ticket_id, event_type, from_status, to_status, from_staff_account_id, to_staff_account_id, actor_account_id, actor_role, note_text, created_at)",
      "values (?, 'created', null, 'open', null, null, ?, 'resident', null, ?)",
    ].join(" "),
  ).run(ticketId, residentAccountId, createdAt);

  if (assignedStaffAccountId) {
    db.prepare(
      [
        "insert into ticket_events",
        "(ticket_id, event_type, from_status, to_status, from_staff_account_id, to_staff_account_id, actor_account_id, actor_role, note_text, created_at)",
        "values (?, 'assigned', 'open', 'assigned', null, ?, ?, 'admin', null, ?)",
      ].join(" "),
    ).run(ticketId, assignedStaffAccountId, residentAccountId, resolvedAssignedAt || createdAt);
  }

  db.close();
  return ticketId;
}

export function linkStaffToApartment({ sqlitePath, staffAccountId, apartmentId }) {
  const db = new DatabaseSync(sqlitePath);
  db.exec("PRAGMA foreign_keys = ON");
  db.prepare(
    [
      "insert into staff_apartment_links (staff_account_id, apartment_id, is_active, linked_at, unlinked_at)",
      "values (?, ?, 1, ?, null)",
    ].join(" "),
  ).run(staffAccountId, apartmentId, nowIso());
  db.close();
}

