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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "helpdesk-m1-"));
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
  insertAccount.run("admin_pm", passwordHash, "admin", createdAt, createdAt);
  insertAccount.run("staff_electric_1", passwordHash, "staff", createdAt, createdAt);

  const residentAccountId = db.prepare("select id from accounts where username = ?").get("resident_flat101").id;
  const adminAccountId = db.prepare("select id from accounts where username = ?").get("admin_pm").id;
  const staffAccountId = db.prepare("select id from accounts where username = ?").get("staff_electric_1").id;

  db.prepare(
    [
      "insert into residents (account_id, apartment_id, full_name, flat_number, mobile_number, created_at, updated_at)",
      "values (?, ?, ?, ?, ?, ?, ?)",
    ].join(" "),
  ).run(residentAccountId, apartmentId, "Flat 101", "101", "9999999999", createdAt, createdAt);

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

test("milestone 1 migration creates auth/session baseline tables", () => {
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
  ];
  for (const tableName of requiredTables) {
    assert.ok(tableNames.includes(tableName), `missing table: ${tableName}`);
  }

  const schemaVersion = db.prepare("select value from meta where key = 'schema_version'").get().value;
  assert.ok(Number(schemaVersion) >= 2);

  db.close();
  cleanup();
});

test("GET / renders login page and session-expired banner", async () => {
  const { sqlitePath, cleanup } = createFixtureDb();
  const fixture = createFixtureApp(sqlitePath);

  const rootResponse = await fixture.app.fetch(new Request("http://helpdesk.local/"));
  assert.equal(rootResponse.status, 200);
  const rootHtml = await rootResponse.text();
  assert.match(rootHtml, /<h1>Helpdesk<\/h1>/);
  assert.doesNotMatch(rootHtml, /Go to Apartment Helpdesk Home \+ Login/);
  assert.match(rootHtml, /name="username"/);
  assert.match(rootHtml, /name="password"/);
  assert.match(rootHtml, /action="\/login"/);

  const expiredResponse = await fixture.app.fetch(
    new Request("http://helpdesk.local/?reason=expired"),
  );
  assert.equal(expiredResponse.status, 200);
  const expiredHtml = await expiredResponse.text();
  assert.match(expiredHtml, /Session expired/);

  fixture.close();
  cleanup();
});

test("POST /login routes by role and sets secure session cookie baseline", async () => {
  const { sqlitePath, cleanup } = createFixtureDb();
  const fixture = createFixtureApp(sqlitePath);

  const loginResponse = await fixture.app.fetch(
    buildFormRequest("http://helpdesk.local/login", {
      username: "resident_flat101",
      password: "password123",
    }),
  );

  assert.equal(loginResponse.status, 303);
  assert.equal(loginResponse.headers.get("location"), "/resident");

  const setCookie = loginResponse.headers.get("set-cookie");
  assert.ok(setCookie);
  assert.match(setCookie, /helpdesk_session=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\//i);

  const adminLoginResponse = await fixture.app.fetch(
    buildFormRequest("http://helpdesk.local/login", {
      username: "admin_pm",
      password: "password123",
    }),
  );
  assert.equal(adminLoginResponse.status, 303);
  assert.equal(adminLoginResponse.headers.get("location"), "/admin");

  const staffLoginResponse = await fixture.app.fetch(
    buildFormRequest("http://helpdesk.local/login", {
      username: "staff_electric_1",
      password: "password123",
    }),
  );
  assert.equal(staffLoginResponse.status, 303);
  assert.equal(staffLoginResponse.headers.get("location"), "/staff");

  fixture.close();
  cleanup();
});

test("POST /login rejects invalid credentials", async () => {
  const { sqlitePath, cleanup } = createFixtureDb();
  const fixture = createFixtureApp(sqlitePath);

  const response = await fixture.app.fetch(
    buildFormRequest("http://helpdesk.local/login", {
      username: "resident_flat101",
      password: "wrong-password",
    }),
  );

  assert.equal(response.status, 401);
  const html = await response.text();
  assert.match(html, /Invalid username or password/i);

  fixture.close();
  cleanup();
});

test("protected route requires valid session and role", async () => {
  const { sqlitePath, cleanup } = createFixtureDb();
  const fixture = createFixtureApp(sqlitePath);

  const unauthResponse = await fixture.app.fetch(new Request("http://helpdesk.local/resident"));
  assert.equal(unauthResponse.status, 303);
  assert.equal(unauthResponse.headers.get("location"), "/?reason=expired");

  const loginResponse = await fixture.app.fetch(
    buildFormRequest("http://helpdesk.local/login", {
      username: "resident_flat101",
      password: "password123",
    }),
  );
  const cookiePair = extractCookiePair(loginResponse.headers.get("set-cookie"));

  const residentResponse = await fixture.app.fetch(
    new Request("http://helpdesk.local/resident", {
      headers: { cookie: cookiePair },
    }),
  );
  assert.equal(residentResponse.status, 200);
  const residentHtml = await residentResponse.text();
  assert.match(residentHtml, /Resident Home \(All Tickets\)/);
  assert.match(residentHtml, /Apartment:<\/strong>\s*Palm Meadows/);
  assert.match(residentHtml, /Flat:<\/strong>\s*101/);
  assert.match(residentHtml, /<a href="\/resident\/account">Profile<\/a>/);
  assert.match(residentHtml, /<button type="submit" class="wide-button">Create Ticket<\/button>/);
  assert.doesNotMatch(residentHtml, /<a href="\/tickets\/new">Create Ticket<\/a>/);

  const forbiddenResponse = await fixture.app.fetch(
    new Request("http://helpdesk.local/admin", {
      headers: { cookie: cookiePair },
    }),
  );
  assert.equal(forbiddenResponse.status, 403);
  const forbiddenHtml = await forbiddenResponse.text();
  assert.match(forbiddenHtml, /Go to Resident Home \(All Tickets\)/);

  const adminLoginResponse = await fixture.app.fetch(
    buildFormRequest("http://helpdesk.local/login", {
      username: "admin_pm",
      password: "password123",
    }),
  );
  const adminCookiePair = extractCookiePair(adminLoginResponse.headers.get("set-cookie"));
  const adminHomeResponse = await fixture.app.fetch(
    new Request("http://helpdesk.local/admin", {
      headers: { cookie: adminCookiePair },
    }),
  );
  assert.equal(adminHomeResponse.status, 200);
  const adminHtml = await adminHomeResponse.text();
  assert.match(adminHtml, /Apartment:<\/strong>\s*Palm Meadows/);
  assert.match(adminHtml, /Flat:<\/strong>\s*N\/A \(Admin account\)/);
  assert.match(adminHtml, /<a href="\/admin\/account">Profile<\/a>/);
  assert.doesNotMatch(adminHtml, /Admin Account/);

  fixture.close();
  cleanup();
});

test("expired session is cleared and redirected to session-expired login", async () => {
  const { sqlitePath, cleanup } = createFixtureDb();
  const fixture = createFixtureApp(sqlitePath);

  const loginResponse = await fixture.app.fetch(
    buildFormRequest("http://helpdesk.local/login", {
      username: "resident_flat101",
      password: "password123",
    }),
  );
  const cookiePair = extractCookiePair(loginResponse.headers.get("set-cookie"));

  const db = new DatabaseSync(sqlitePath);
  db.prepare("update sessions set expires_at = ?").run("2000-01-01T00:00:00.000Z");
  db.close();

  const response = await fixture.app.fetch(
    new Request("http://helpdesk.local/resident", {
      headers: { cookie: cookiePair },
    }),
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/?reason=expired");
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/i);

  fixture.close();
  cleanup();
});

test("POST /logout enforces CSRF for authenticated session", async () => {
  const { sqlitePath, cleanup } = createFixtureDb();
  const fixture = createFixtureApp(sqlitePath);

  const loginResponse = await fixture.app.fetch(
    buildFormRequest("http://helpdesk.local/login", {
      username: "resident_flat101",
      password: "password123",
    }),
  );
  const cookiePair = extractCookiePair(loginResponse.headers.get("set-cookie"));

  const homeResponse = await fixture.app.fetch(
    new Request("http://helpdesk.local/resident", {
      headers: { cookie: cookiePair },
    }),
  );
  const homeHtml = await homeResponse.text();
  const csrfToken = extractCsrfToken(homeHtml);

  const missingCsrfResponse = await fixture.app.fetch(
    buildFormRequest("http://helpdesk.local/logout", {}, cookiePair),
  );
  assert.equal(missingCsrfResponse.status, 403);

  const logoutResponse = await fixture.app.fetch(
    buildFormRequest(
      "http://helpdesk.local/logout",
      {
        csrf_token: csrfToken,
      },
      cookiePair,
    ),
  );

  assert.equal(logoutResponse.status, 303);
  assert.equal(logoutResponse.headers.get("location"), "/?reason=logged_out");
  assert.match(logoutResponse.headers.get("set-cookie"), /Max-Age=0/i);

  const db = new DatabaseSync(sqlitePath);
  const activeSessions = db
    .prepare("select count(*) as count from sessions where revoked_at is null")
    .get().count;
  assert.equal(activeSessions, 0);
  db.close();

  fixture.close();
  cleanup();
});
