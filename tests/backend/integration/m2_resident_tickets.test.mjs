import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";

import { createApp } from "../../../src/app/index.mjs";
import { createNodeDbAdapter } from "../../../src/app/db/node-adapter.mjs";
import { applyMigrations } from "../../../src/app/migrations.mjs";

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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "helpdesk-m2-"));
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
  const apartmentId = db.prepare("select id from apartments where code = ?").get("PM").id;

  const passwordHash = bcrypt.hashSync("password123", 10);
  const insertAccount = db.prepare(
    "insert into accounts (username, password_hash, role, is_active, created_at, updated_at) values (?, ?, ?, 1, ?, ?)",
  );
  insertAccount.run("resident_flat101", passwordHash, "resident", createdAt, createdAt);
  insertAccount.run("resident_flat102", passwordHash, "resident", createdAt, createdAt);
  insertAccount.run("admin_pm", passwordHash, "admin", createdAt, createdAt);
  insertAccount.run("staff_electric_1", passwordHash, "staff", createdAt, createdAt);

  const resident101AccountId = db.prepare("select id from accounts where username = ?").get("resident_flat101").id;
  const resident102AccountId = db.prepare("select id from accounts where username = ?").get("resident_flat102").id;
  const adminAccountId = db.prepare("select id from accounts where username = ?").get("admin_pm").id;
  const staffAccountId = db.prepare("select id from accounts where username = ?").get("staff_electric_1").id;

  db.prepare(
    [
      "insert into residents (account_id, apartment_id, full_name, flat_number, mobile_number, created_at, updated_at)",
      "values (?, ?, ?, ?, ?, ?, ?)",
    ].join(" "),
  ).run(resident101AccountId, apartmentId, "Flat 101", "101", "9999999999", createdAt, createdAt);
  db.prepare(
    [
      "insert into residents (account_id, apartment_id, full_name, flat_number, mobile_number, created_at, updated_at)",
      "values (?, ?, ?, ?, ?, ?, ?)",
    ].join(" "),
  ).run(resident102AccountId, apartmentId, "Flat 102", "102", "9999999998", createdAt, createdAt);
  db.prepare(
    [
      "insert into admins (account_id, apartment_id, display_name, mobile_number, is_shared_account, created_at, updated_at)",
      "values (?, ?, ?, ?, 1, ?, ?)",
    ].join(" "),
  ).run(adminAccountId, apartmentId, "Palm Meadows Admin", "8888888888", createdAt, createdAt);
  db.prepare(
    "insert into staff (account_id, full_name, mobile_number, staff_type, created_at, updated_at) values (?, ?, ?, ?, ?, ?)",
  ).run(staffAccountId, "Electric Staff", "7777777777", "electrician", createdAt, createdAt);

  db.close();

  return {
    sqlitePath,
    apartmentId,
    resident101AccountId,
    resident102AccountId,
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

async function loginAndSession(app, username) {
  const loginResponse = await app.fetch(
    buildFormRequest("http://helpdesk.local/login", {
      username,
      password: "password123",
    }),
  );
  assert.equal(loginResponse.status, 303);
  const cookiePair = extractCookiePair(loginResponse.headers.get("set-cookie"));
  const homeResponse = await app.fetch(
    new Request("http://helpdesk.local/resident", {
      headers: { cookie: cookiePair },
    }),
  );
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
  status = "open",
  title = "Bedroom switch not working",
  description = "The bedroom switch is sparking and needs service.",
  issueType = "electrical",
}) {
  const db = new DatabaseSync(sqlitePath);
  const createdAt = nowIso();
  db.prepare(
    [
      "insert into tickets",
      "(ticket_number, apartment_id, resident_account_id, resident_flat_snapshot, issue_type, title, description, status,",
      "assigned_staff_account_id, created_at, updated_at, assigned_at, in_progress_at, completed_at, completed_by_admin_cancel)",
      "values (?, ?, ?, ?, ?, ?, ?, ?, null, ?, ?, null, null, null, 0)",
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
    createdAt,
    createdAt,
  );
  const ticketId = db.prepare("select id from tickets where ticket_number = ?").get(ticketNumber).id;
  db.prepare(
    [
      "insert into ticket_events",
      "(ticket_id, event_type, from_status, to_status, from_staff_account_id, to_staff_account_id, actor_account_id, actor_role, note_text, created_at)",
      "values (?, 'created', null, 'open', null, null, ?, 'resident', null, ?)",
    ].join(" "),
  ).run(ticketId, residentAccountId, createdAt);
  db.close();
  return ticketId;
}

test("milestone 2 migration creates ticket tables and updates schema version", () => {
  const { sqlitePath, cleanup } = createFixtureDb();
  const db = new DatabaseSync(sqlitePath);

  const rows = db
    .prepare(
      "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name",
    )
    .all();
  const tableNames = rows.map((row) => row.name);

  const requiredTables = [
    "accounts",
    "admins",
    "apartments",
    "meta",
    "residents",
    "schema_migrations",
    "sessions",
    "staff",
    "ticket_comments",
    "ticket_events",
    "tickets",
  ];
  for (const tableName of requiredTables) {
    assert.ok(tableNames.includes(tableName), `missing table: ${tableName}`);
  }

  const schemaVersion = db.prepare("select value from meta where key = 'schema_version'").get().value;
  assert.ok(Number(schemaVersion) >= 3);

  db.close();
  cleanup();
});

test("resident home shows active ticket count and resident ticket list", async () => {
  const fixtureDb = createFixtureDb();
  const ticketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-000001",
  });
  const fixture = createFixtureApp(fixtureDb.sqlitePath);

  const { cookiePair } = await loginAndSession(fixture.app, "resident_flat101");
  const response = await fixture.app.fetch(
    new Request("http://helpdesk.local/resident", {
      headers: { cookie: cookiePair },
    }),
  );

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /1<\/span>\s*<span class="active-count-label">Active Ticket\(s\)<\/span>/);
  assert.match(html, /PM-000001/);
  assert.match(html, new RegExp(`href="/tickets/${ticketId}"`));

  fixture.close();
  fixtureDb.cleanup();
});

test("POST /tickets creates resident ticket and created event", async () => {
  const fixtureDb = createFixtureDb();
  const fixture = createFixtureApp(fixtureDb.sqlitePath);

  const { cookiePair, csrfToken } = await loginAndSession(fixture.app, "resident_flat101");
  const createResponse = await fixture.app.fetch(
    buildFormRequest(
      "http://helpdesk.local/tickets",
      {
        csrf_token: csrfToken,
        issue_type: "electrical",
        title: "Kitchen switch is sparking",
        description: "Kitchen switch sparks whenever it is turned on.",
      },
      cookiePair,
    ),
  );

  assert.equal(createResponse.status, 303);
  const location = createResponse.headers.get("location");
  assert.match(location, /^\/tickets\/\d+$/);
  const createdTicketId = Number.parseInt(location.split("/").pop(), 10);

  const db = new DatabaseSync(fixtureDb.sqlitePath);
  const ticket = db.prepare("select ticket_number, status from tickets where id = ?").get(createdTicketId);
  assert.ok(ticket);
  assert.match(ticket.ticket_number, /^PM-\d{6}$/);
  assert.equal(ticket.status, "open");

  const eventCount = db
    .prepare("select count(*) as count from ticket_events where ticket_id = ? and event_type = 'created'")
    .get(createdTicketId).count;
  assert.equal(eventCount, 1);
  db.close();

  fixture.close();
  fixtureDb.cleanup();
});

test("POST /tickets returns 422 with validation errors", async () => {
  const fixtureDb = createFixtureDb();
  const fixture = createFixtureApp(fixtureDb.sqlitePath);

  const { cookiePair, csrfToken } = await loginAndSession(fixture.app, "resident_flat101");
  const createResponse = await fixture.app.fetch(
    buildFormRequest(
      "http://helpdesk.local/tickets",
      {
        csrf_token: csrfToken,
        issue_type: "invalid-type",
        title: "short",
        description: "tiny",
      },
      cookiePair,
    ),
  );

  assert.equal(createResponse.status, 422);
  const html = await createResponse.text();
  assert.match(html, /Issue type must be electrical or plumbing/);
  assert.match(html, /Title must be between 8 and 120 characters/);
  assert.match(html, /Description must be at least 10 characters/);
  assert.match(html, /value="short"/);

  fixture.close();
  fixtureDb.cleanup();
});

test("POST /tickets returns 409 when active ticket limit is reached", async () => {
  const fixtureDb = createFixtureDb();
  for (let i = 1; i <= 5; i += 1) {
    insertTicket({
      sqlitePath: fixtureDb.sqlitePath,
      apartmentId: fixtureDb.apartmentId,
      residentAccountId: fixtureDb.resident101AccountId,
      flatNumber: "101",
      ticketNumber: `PM-10000${i}`,
      title: `Issue number ${i} for active cap`,
      description: `Description for issue number ${i} in active cap validation test.`,
      status: i === 5 ? "assigned" : "open",
    });
  }

  const fixture = createFixtureApp(fixtureDb.sqlitePath);
  const { cookiePair, csrfToken } = await loginAndSession(fixture.app, "resident_flat101");
  const createResponse = await fixture.app.fetch(
    buildFormRequest(
      "http://helpdesk.local/tickets",
      {
        csrf_token: csrfToken,
        issue_type: "plumbing",
        title: "Bathroom pipe has leakage",
        description: "Water leakage continues from the bathroom pipe near the wall.",
      },
      cookiePair,
    ),
  );

  assert.equal(createResponse.status, 409);
  const html = await createResponse.text();
  assert.match(html, /Active ticket limit reached/);

  fixture.close();
  fixtureDb.cleanup();
});

test("GET /tickets/:id returns 404 for resident not owning the ticket", async () => {
  const fixtureDb = createFixtureDb();
  const ticketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-000010",
  });
  const fixture = createFixtureApp(fixtureDb.sqlitePath);

  const { cookiePair } = await loginAndSession(fixture.app, "resident_flat102");
  const detailResponse = await fixture.app.fetch(
    new Request(`http://helpdesk.local/tickets/${ticketId}`, {
      headers: { cookie: cookiePair },
    }),
  );

  assert.equal(detailResponse.status, 404);

  fixture.close();
  fixtureDb.cleanup();
});

test("POST /tickets/:id/comments creates ticket comment for resident owner", async () => {
  const fixtureDb = createFixtureDb();
  const ticketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-000020",
  });
  const fixture = createFixtureApp(fixtureDb.sqlitePath);

  const { cookiePair } = await loginAndSession(fixture.app, "resident_flat101");
  const detailResponse = await fixture.app.fetch(
    new Request(`http://helpdesk.local/tickets/${ticketId}`, {
      headers: { cookie: cookiePair },
    }),
  );
  const detailHtml = await detailResponse.text();
  const csrfToken = extractCsrfToken(detailHtml);

  const commentResponse = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/comments`,
      {
        csrf_token: csrfToken,
        comment_text: "Please call me before visiting the flat.",
      },
      cookiePair,
    ),
  );
  assert.equal(commentResponse.status, 303);
  assert.equal(commentResponse.headers.get("location"), `/tickets/${ticketId}`);

  const pageAfterComment = await fixture.app.fetch(
    new Request(`http://helpdesk.local/tickets/${ticketId}`, {
      headers: { cookie: cookiePair },
    }),
  );
  const htmlAfterComment = await pageAfterComment.text();
  assert.match(htmlAfterComment, /Please call me before visiting the flat/);

  const db = new DatabaseSync(fixtureDb.sqlitePath);
  const commentCount = db.prepare("select count(*) as count from ticket_comments where ticket_id = ?").get(ticketId).count;
  assert.equal(commentCount, 1);
  db.close();

  fixture.close();
  fixtureDb.cleanup();
});

test("POST /tickets/:id/comments returns 422 for invalid comment input", async () => {
  const fixtureDb = createFixtureDb();
  const ticketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-000030",
  });
  const fixture = createFixtureApp(fixtureDb.sqlitePath);

  const { cookiePair } = await loginAndSession(fixture.app, "resident_flat101");
  const detailResponse = await fixture.app.fetch(
    new Request(`http://helpdesk.local/tickets/${ticketId}`, {
      headers: { cookie: cookiePair },
    }),
  );
  const detailHtml = await detailResponse.text();
  const csrfToken = extractCsrfToken(detailHtml);

  const commentResponse = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/comments`,
      {
        csrf_token: csrfToken,
        comment_text: "   ",
      },
      cookiePair,
    ),
  );

  assert.equal(commentResponse.status, 422);
  const html = await commentResponse.text();
  assert.match(html, /Comment must be between 1 and 2000 characters/);

  fixture.close();
  fixtureDb.cleanup();
});

test("POST /tickets/:id/comments returns 409 for completed ticket", async () => {
  const fixtureDb = createFixtureDb();
  const ticketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-000040",
    status: "completed",
  });
  const fixture = createFixtureApp(fixtureDb.sqlitePath);

  const { cookiePair } = await loginAndSession(fixture.app, "resident_flat101");
  const detailResponse = await fixture.app.fetch(
    new Request(`http://helpdesk.local/tickets/${ticketId}`, {
      headers: { cookie: cookiePair },
    }),
  );
  const detailHtml = await detailResponse.text();
  const csrfToken = extractCsrfToken(detailHtml);

  const commentResponse = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/comments`,
      {
        csrf_token: csrfToken,
        comment_text: "Trying to comment after completion.",
      },
      cookiePair,
    ),
  );

  assert.equal(commentResponse.status, 409);
  const html = await commentResponse.text();
  assert.match(html, /Comments are closed/);

  fixture.close();
  fixtureDb.cleanup();
});

test("resident ticket mutations enforce CSRF tokens", async () => {
  const fixtureDb = createFixtureDb();
  const ticketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-000050",
  });
  const fixture = createFixtureApp(fixtureDb.sqlitePath);

  const { cookiePair } = await loginAndSession(fixture.app, "resident_flat101");

  const createWithoutCsrf = await fixture.app.fetch(
    buildFormRequest(
      "http://helpdesk.local/tickets",
      {
        issue_type: "electrical",
        title: "New socket has short circuit",
        description: "The new socket in hall has a short circuit issue.",
      },
      cookiePair,
    ),
  );
  assert.equal(createWithoutCsrf.status, 403);

  const commentWithoutCsrf = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/comments`,
      {
        comment_text: "Comment without csrf token.",
      },
      cookiePair,
    ),
  );
  assert.equal(commentWithoutCsrf.status, 403);

  fixture.close();
  fixtureDb.cleanup();
});
