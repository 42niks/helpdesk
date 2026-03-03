import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";

import { createApp } from "../../src/app/index.mjs";
import { createNodeDbAdapter } from "../../src/app/db/node-adapter.mjs";
import { applyMigrations } from "../../src/app/migrations.mjs";

function nowIso() {
  return new Date().toISOString();
}

function buildFormRequest(url, fields, cookie) {
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

function extractCookiePair(setCookie) {
  assert.ok(setCookie, "missing Set-Cookie");
  return setCookie.split(";")[0];
}

function extractCsrfToken(html) {
  const match = html.match(/name="csrf_token"\s+value="([^"]+)"/i);
  assert.ok(match, "missing csrf_token hidden input");
  return match[1];
}

function createFixtureDb() {
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

function createFixtureApp(sqlitePath) {
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

async function loginAndSession(app, username, roleHomePath) {
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

function insertTicket({
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
}) {
  const db = new DatabaseSync(sqlitePath);
  const createdAt = nowIso();
  const assignedAt = (status === "assigned" || status === "in_progress" || status === "completed") ? createdAt : null;
  const inProgressAt = (status === "in_progress" || status === "completed") ? createdAt : null;
  const completedAt = status === "completed" ? createdAt : null;

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
    createdAt,
    assignedAt,
    inProgressAt,
    completedAt,
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
    ).run(ticketId, assignedStaffAccountId, residentAccountId, createdAt);
  }

  db.close();
  return ticketId;
}

test("milestone 3+ migration adds staff links and ticket reviews tables", () => {
  const { sqlitePath, cleanup } = createFixtureDb();
  const db = new DatabaseSync(sqlitePath);

  const rows = db
    .prepare(
      "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name",
    )
    .all();
  const tableNames = rows.map((row) => row.name);

  assert.ok(tableNames.includes("staff_apartment_links"));
  assert.ok(tableNames.includes("ticket_reviews"));

  const schemaVersion = db.prepare("select value from meta where key = 'schema_version'").get().value;
  assert.equal(schemaVersion, "4");

  db.close();
  cleanup();
});

test("admin can assign linked and matching staff to an open ticket", async () => {
  const fixtureDb = createFixtureDb();
  const ticketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-100001",
    issueType: "electrical",
  });

  const fixture = createFixtureApp(fixtureDb.sqlitePath);
  const { cookiePair, csrfToken } = await loginAndSession(fixture.app, "admin_pm", "/admin");

  const response = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/assign`,
      {
        csrf_token: csrfToken,
        staff_account_id: String(fixtureDb.staffElectric1AccountId),
      },
      cookiePair,
    ),
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), `/tickets/${ticketId}`);

  const db = new DatabaseSync(fixtureDb.sqlitePath);
  const ticket = db.prepare("select status, assigned_staff_account_id, assigned_at from tickets where id = ?").get(ticketId);
  assert.equal(ticket.status, "assigned");
  assert.equal(ticket.assigned_staff_account_id, fixtureDb.staffElectric1AccountId);
  assert.ok(ticket.assigned_at);

  const assignedEvents = db
    .prepare("select count(*) as count from ticket_events where ticket_id = ? and event_type = 'assigned'")
    .get(ticketId).count;
  assert.equal(assignedEvents, 1);
  db.close();

  fixture.close();
  fixtureDb.cleanup();
});

test("admin assignment rejects type mismatch and unlinked staff", async () => {
  const fixtureDb = createFixtureDb();
  const ticketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-100002",
    issueType: "electrical",
  });

  const fixture = createFixtureApp(fixtureDb.sqlitePath);
  const { cookiePair, csrfToken } = await loginAndSession(fixture.app, "admin_pm", "/admin");

  const mismatchResponse = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/assign`,
      {
        csrf_token: csrfToken,
        staff_account_id: String(fixtureDb.staffPlumber1AccountId),
      },
      cookiePair,
    ),
  );
  assert.equal(mismatchResponse.status, 422);
  const mismatchHtml = await mismatchResponse.text();
  assert.match(mismatchHtml, /Staff type does not match ticket issue type/i);

  const unlinkedResponse = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/assign`,
      {
        csrf_token: csrfToken,
        staff_account_id: String(fixtureDb.staffElectric2AccountId),
      },
      cookiePair,
    ),
  );
  assert.equal(unlinkedResponse.status, 422);
  const unlinkedHtml = await unlinkedResponse.text();
  assert.match(unlinkedHtml, /Staff is not actively linked to this apartment/i);

  fixture.close();
  fixtureDb.cleanup();
});

test("shared ticket detail visibility: resident owner, admin apartment, assigned staff", async () => {
  const fixtureDb = createFixtureDb();
  const ticketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-100003",
    status: "assigned",
    assignedStaffAccountId: fixtureDb.staffElectric1AccountId,
  });

  const fixture = createFixtureApp(fixtureDb.sqlitePath);

  const resident = await loginAndSession(fixture.app, "resident_flat101", "/resident");
  const residentResponse = await fixture.app.fetch(
    new Request(`http://helpdesk.local/tickets/${ticketId}`, {
      headers: { cookie: resident.cookiePair },
    }),
  );
  assert.equal(residentResponse.status, 200);

  const admin = await loginAndSession(fixture.app, "admin_pm", "/admin");
  const adminResponse = await fixture.app.fetch(
    new Request(`http://helpdesk.local/tickets/${ticketId}`, {
      headers: { cookie: admin.cookiePair },
    }),
  );
  assert.equal(adminResponse.status, 200);
  assert.match(await adminResponse.text(), /Admin Home \(All Tickets\)/);

  const staffAssigned = await loginAndSession(fixture.app, "staff_electric_1", "/staff");
  const staffResponse = await fixture.app.fetch(
    new Request(`http://helpdesk.local/tickets/${ticketId}`, {
      headers: { cookie: staffAssigned.cookiePair },
    }),
  );
  assert.equal(staffResponse.status, 200);
  assert.match(await staffResponse.text(), /Staff Home \(Assigned Tickets\)/);

  const staffNotAssigned = await loginAndSession(fixture.app, "staff_plumber_1", "/staff");
  const hiddenResponse = await fixture.app.fetch(
    new Request(`http://helpdesk.local/tickets/${ticketId}`, {
      headers: { cookie: staffNotAssigned.cookiePair },
    }),
  );
  assert.equal(hiddenResponse.status, 404);

  const residentNotOwner = await loginAndSession(fixture.app, "resident_flat102", "/resident");
  const notOwnerResponse = await fixture.app.fetch(
    new Request(`http://helpdesk.local/tickets/${ticketId}`, {
      headers: { cookie: residentNotOwner.cookiePair },
    }),
  );
  assert.equal(notOwnerResponse.status, 404);

  fixture.close();
  fixtureDb.cleanup();
});

test("staff can progress assigned ticket to in_progress and completed", async () => {
  const fixtureDb = createFixtureDb();
  const ticketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-100004",
    status: "assigned",
    assignedStaffAccountId: fixtureDb.staffElectric1AccountId,
  });

  const fixture = createFixtureApp(fixtureDb.sqlitePath);
  const { cookiePair, csrfToken } = await loginAndSession(fixture.app, "staff_electric_1", "/staff");

  const inProgressResponse = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/status`,
      {
        csrf_token: csrfToken,
        next_status: "in_progress",
      },
      cookiePair,
    ),
  );
  assert.equal(inProgressResponse.status, 303);

  const completedResponse = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/status`,
      {
        csrf_token: csrfToken,
        next_status: "completed",
      },
      cookiePair,
    ),
  );
  assert.equal(completedResponse.status, 303);

  const db = new DatabaseSync(fixtureDb.sqlitePath);
  const ticket = db
    .prepare("select status, in_progress_at, completed_at, completed_by_admin_cancel from tickets where id = ?")
    .get(ticketId);
  assert.equal(ticket.status, "completed");
  assert.ok(ticket.in_progress_at);
  assert.ok(ticket.completed_at);
  assert.equal(ticket.completed_by_admin_cancel, 0);

  const statusEvents = db
    .prepare("select count(*) as count from ticket_events where ticket_id = ? and event_type = 'status_changed'")
    .get(ticketId).count;
  assert.equal(statusEvents, 2);
  db.close();

  fixture.close();
  fixtureDb.cleanup();
});

test("staff invalid status transition returns 409", async () => {
  const fixtureDb = createFixtureDb();
  const ticketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-100005",
    status: "assigned",
    assignedStaffAccountId: fixtureDb.staffElectric1AccountId,
  });

  const fixture = createFixtureApp(fixtureDb.sqlitePath);
  const { cookiePair, csrfToken } = await loginAndSession(fixture.app, "staff_electric_1", "/staff");

  const response = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/status`,
      {
        csrf_token: csrfToken,
        next_status: "completed",
      },
      cookiePair,
    ),
  );

  assert.equal(response.status, 409);

  fixture.close();
  fixtureDb.cleanup();
});

test("admin completion requires cancel reason and records audit trail", async () => {
  const fixtureDb = createFixtureDb();
  const ticketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-100006",
    status: "open",
  });

  const fixture = createFixtureApp(fixtureDb.sqlitePath);
  const { cookiePair, csrfToken } = await loginAndSession(fixture.app, "admin_pm", "/admin");

  const missingReasonResponse = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/status`,
      {
        csrf_token: csrfToken,
        next_status: "completed",
        cancel_reason: "   ",
      },
      cookiePair,
    ),
  );
  assert.equal(missingReasonResponse.status, 422);
  assert.match(await missingReasonResponse.text(), /Cancellation reason is required/i);

  const reasonText = "Cancelled as duplicate of existing complaint.";
  const completionResponse = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/status`,
      {
        csrf_token: csrfToken,
        next_status: "completed",
        cancel_reason: reasonText,
      },
      cookiePair,
    ),
  );
  assert.equal(completionResponse.status, 303);

  const db = new DatabaseSync(fixtureDb.sqlitePath);
  const ticket = db.prepare("select status, completed_by_admin_cancel from tickets where id = ?").get(ticketId);
  assert.equal(ticket.status, "completed");
  assert.equal(ticket.completed_by_admin_cancel, 1);

  const event = db
    .prepare("select event_type, note_text from ticket_events where ticket_id = ? order by id desc limit 1")
    .get(ticketId);
  assert.equal(event.event_type, "admin_completed_cancel");
  assert.equal(event.note_text, reasonText);

  const comment = db
    .prepare("select comment_text, author_role from ticket_comments where ticket_id = ? order by id desc limit 1")
    .get(ticketId);
  assert.equal(comment.comment_text, reasonText);
  assert.equal(comment.author_role, "admin");

  db.close();

  fixture.close();
  fixtureDb.cleanup();
});

test("resident review submission supports rating and text and blocks duplicates", async () => {
  const fixtureDb = createFixtureDb();
  const ticketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-100007",
    status: "completed",
    assignedStaffAccountId: fixtureDb.staffElectric1AccountId,
  });

  const fixture = createFixtureApp(fixtureDb.sqlitePath);
  const { cookiePair } = await loginAndSession(fixture.app, "resident_flat101", "/resident");

  const detailResponse = await fixture.app.fetch(
    new Request(`http://helpdesk.local/tickets/${ticketId}`, {
      headers: { cookie: cookiePair },
    }),
  );
  const detailHtml = await detailResponse.text();
  const csrfToken = extractCsrfToken(detailHtml);

  const reviewResponse = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/review`,
      {
        csrf_token: csrfToken,
        rating: "5",
        review_text: "Great and quick service.",
      },
      cookiePair,
    ),
  );
  assert.equal(reviewResponse.status, 303);

  const db = new DatabaseSync(fixtureDb.sqlitePath);
  const review = db
    .prepare("select rating, review_text, resident_account_id, staff_account_id from ticket_reviews where ticket_id = ?")
    .get(ticketId);
  assert.equal(review.rating, 5);
  assert.equal(review.review_text, "Great and quick service.");
  assert.equal(review.resident_account_id, fixtureDb.resident101AccountId);
  assert.equal(review.staff_account_id, fixtureDb.staffElectric1AccountId);
  db.close();

  const duplicateResponse = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/review`,
      {
        csrf_token: csrfToken,
        rating: "4",
      },
      cookiePair,
    ),
  );
  assert.equal(duplicateResponse.status, 409);

  fixture.close();
  fixtureDb.cleanup();
});

test("resident review text without rating returns 422", async () => {
  const fixtureDb = createFixtureDb();
  const ticketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-100008",
    status: "completed",
    assignedStaffAccountId: fixtureDb.staffElectric1AccountId,
  });

  const fixture = createFixtureApp(fixtureDb.sqlitePath);
  const { cookiePair } = await loginAndSession(fixture.app, "resident_flat101", "/resident");

  const detailResponse = await fixture.app.fetch(
    new Request(`http://helpdesk.local/tickets/${ticketId}`, {
      headers: { cookie: cookiePair },
    }),
  );
  const detailHtml = await detailResponse.text();
  const csrfToken = extractCsrfToken(detailHtml);

  const response = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/review`,
      {
        csrf_token: csrfToken,
        review_text: "Review text without a rating should fail.",
      },
      cookiePair,
    ),
  );

  assert.equal(response.status, 422);
  const html = await response.text();
  assert.match(html, /Review text requires a rating/i);

  fixture.close();
  fixtureDb.cleanup();
});

test("resident and admin ratings pages show scoped data", async () => {
  const fixtureDb = createFixtureDb();

  const palmTicketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-100009",
    status: "completed",
    assignedStaffAccountId: fixtureDb.staffElectric1AccountId,
  });

  const lakeTicketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentLakeId,
    residentAccountId: fixtureDb.residentLv201AccountId,
    flatNumber: "201",
    ticketNumber: "LV-100001",
    status: "completed",
    assignedStaffAccountId: fixtureDb.staffElectric2AccountId,
  });

  const db = new DatabaseSync(fixtureDb.sqlitePath);
  const createdAt = nowIso();
  db.prepare(
    [
      "insert into ticket_reviews (ticket_id, resident_account_id, staff_account_id, rating, review_text, created_at)",
      "values (?, ?, ?, ?, ?, ?)",
    ].join(" "),
  ).run(palmTicketId, fixtureDb.resident101AccountId, fixtureDb.staffElectric1AccountId, 5, "Excellent work in PM.", createdAt);
  db.prepare(
    [
      "insert into ticket_reviews (ticket_id, resident_account_id, staff_account_id, rating, review_text, created_at)",
      "values (?, ?, ?, ?, ?, ?)",
    ].join(" "),
  ).run(lakeTicketId, fixtureDb.residentLv201AccountId, fixtureDb.staffElectric2AccountId, 4, "Great work in LV.", createdAt);
  db.close();

  const fixture = createFixtureApp(fixtureDb.sqlitePath);

  const residentPalm = await loginAndSession(fixture.app, "resident_flat101", "/resident");
  const residentRatings = await fixture.app.fetch(
    new Request("http://helpdesk.local/resident/staff-ratings", {
      headers: { cookie: residentPalm.cookiePair },
    }),
  );
  assert.equal(residentRatings.status, 200);
  const residentRatingsHtml = await residentRatings.text();
  assert.match(residentRatingsHtml, /Electric Staff One/);
  assert.match(residentRatingsHtml, /Excellent work in PM\./);
  assert.doesNotMatch(residentRatingsHtml, /Electric Staff Two/);
  assert.doesNotMatch(residentRatingsHtml, /Great work in LV\./);

  const adminPalm = await loginAndSession(fixture.app, "admin_pm", "/admin");
  const adminApartmentRatings = await fixture.app.fetch(
    new Request("http://helpdesk.local/admin/staff", {
      headers: { cookie: adminPalm.cookiePair },
    }),
  );
  assert.equal(adminApartmentRatings.status, 200);
  const adminApartmentHtml = await adminApartmentRatings.text();
  assert.match(adminApartmentHtml, /Excellent work in PM\./);
  assert.doesNotMatch(adminApartmentHtml, /Great work in LV\./);

  const adminPlatformRatings = await fixture.app.fetch(
    new Request("http://helpdesk.local/admin/staff?view=platform", {
      headers: { cookie: adminPalm.cookiePair },
    }),
  );
  assert.equal(adminPlatformRatings.status, 200);
  const adminPlatformHtml = await adminPlatformRatings.text();
  assert.match(adminPlatformHtml, /Electric Staff One/);
  assert.match(adminPlatformHtml, /Electric Staff Two/);
  assert.doesNotMatch(adminPlatformHtml, /Excellent work in PM\./);
  assert.doesNotMatch(adminPlatformHtml, /Great work in LV\./);

  fixture.close();
  fixtureDb.cleanup();
});
