import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import {
  buildFormRequest,
  createFixtureApp,
  createFixtureDb,
  extractCsrfToken,
  extractTicketIdFromLocation,
  hoursAgoIso,
  insertTicket,
  linkStaffToApartment,
  loginAndSession,
  nowIso,
} from "./helpers/m3plus_helpers.mjs";

test("milestone 5 migration adds ticket reviews table and schema advances", () => {
  const { sqlitePath, cleanup } = createFixtureDb();
  const db = new DatabaseSync(sqlitePath);

  const rows = db
    .prepare(
      "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name",
    )
    .all();
  const tableNames = rows.map((row) => row.name);
  assert.ok(tableNames.includes("ticket_reviews"));

  const schemaVersion = db.prepare("select value from meta where key = 'schema_version'").get().value;
  assert.ok(Number(schemaVersion) >= 5);

  db.close();
  cleanup();
});

test("full workflow: resident create, admin assign, staff comment+complete, resident review, rating visible", async () => {
  const fixtureDb = createFixtureDb();
  const fixture = createFixtureApp(fixtureDb.sqlitePath);

  const resident = await loginAndSession(fixture.app, "resident_flat101", "/resident");
  const createResponse = await fixture.app.fetch(
    buildFormRequest(
      "http://helpdesk.local/tickets",
      {
        csrf_token: resident.csrfToken,
        issue_type: "electrical",
        title: "Ceiling fan regulator not responding",
        description: "The regulator in bedroom is not changing speed and needs electrician support.",
      },
      resident.cookiePair,
    ),
  );
  assert.equal(createResponse.status, 303);
  const ticketId = extractTicketIdFromLocation(createResponse.headers.get("location"));

  const admin = await loginAndSession(fixture.app, "admin_pm", "/admin");
  const assignResponse = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/assign`,
      {
        csrf_token: admin.csrfToken,
        staff_account_id: String(fixtureDb.staffElectric1AccountId),
      },
      admin.cookiePair,
    ),
  );
  assert.equal(assignResponse.status, 303);

  const staff = await loginAndSession(fixture.app, "staff_electric_1", "/staff");
  const staffComment = "Visited site, replacing damaged regulator module.";
  const commentResponse = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/comments`,
      {
        csrf_token: staff.csrfToken,
        comment_text: staffComment,
      },
      staff.cookiePair,
    ),
  );
  assert.equal(commentResponse.status, 303);

  const inProgressResponse = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/status`,
      {
        csrf_token: staff.csrfToken,
        next_status: "in_progress",
      },
      staff.cookiePair,
    ),
  );
  assert.equal(inProgressResponse.status, 303);

  const completedResponse = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/status`,
      {
        csrf_token: staff.csrfToken,
        next_status: "completed",
      },
      staff.cookiePair,
    ),
  );
  assert.equal(completedResponse.status, 303);

  const residentDetail = await fixture.app.fetch(
    new Request(`http://helpdesk.local/tickets/${ticketId}`, {
      headers: { cookie: resident.cookiePair },
    }),
  );
  assert.equal(residentDetail.status, 200);
  const residentDetailHtml = await residentDetail.text();
  const residentDetailCsrf = extractCsrfToken(residentDetailHtml);

  const reviewText = "Quick resolution and polite communication.";
  const reviewResponse = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/review`,
      {
        csrf_token: residentDetailCsrf,
        rating: "5",
        review_text: reviewText,
      },
      resident.cookiePair,
    ),
  );
  assert.equal(reviewResponse.status, 303);

  const ratingsPage = await fixture.app.fetch(
    new Request("http://helpdesk.local/resident/staff-ratings", {
      headers: { cookie: resident.cookiePair },
    }),
  );
  assert.equal(ratingsPage.status, 200);
  const ratingsHtml = await ratingsPage.text();
  assert.match(ratingsHtml, /Electric Staff One/);
  assert.match(ratingsHtml, /1 ratings/);
  assert.match(ratingsHtml, /5\.00/);
  assert.match(ratingsHtml, new RegExp(`href="/resident/staff-ratings/${fixtureDb.staffElectric1AccountId}"`));
  assert.doesNotMatch(ratingsHtml, /Quick resolution and polite communication\./);

  const reviewsDetailPage = await fixture.app.fetch(
    new Request(`http://helpdesk.local/resident/staff-ratings/${fixtureDb.staffElectric1AccountId}`, {
      headers: { cookie: resident.cookiePair },
    }),
  );
  assert.equal(reviewsDetailPage.status, 200);
  const reviewsDetailHtml = await reviewsDetailPage.text();
  assert.match(reviewsDetailHtml, /Text Reviews/);
  assert.match(reviewsDetailHtml, /Quick resolution and polite communication\./);

  const db = new DatabaseSync(fixtureDb.sqlitePath);
  const staffCommentRow = db
    .prepare("select author_role, comment_text from ticket_comments where ticket_id = ? and author_role = 'staff' limit 1")
    .get(ticketId);
  assert.equal(staffCommentRow.author_role, "staff");
  assert.equal(staffCommentRow.comment_text, staffComment);
  db.close();

  fixture.close();
  fixtureDb.cleanup();
});

test("resident ratings summary/detail and admin ratings pages show scoped data", async () => {
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
  const lakeTicketIdForPalmStaff = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentLakeId,
    residentAccountId: fixtureDb.residentLv201AccountId,
    flatNumber: "201",
    ticketNumber: "LV-100002",
    status: "completed",
    assignedStaffAccountId: fixtureDb.staffElectric1AccountId,
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
  db.prepare(
    [
      "insert into ticket_reviews (ticket_id, resident_account_id, staff_account_id, rating, review_text, created_at)",
      "values (?, ?, ?, ?, ?, ?)",
    ].join(" "),
  ).run(lakeTicketIdForPalmStaff, fixtureDb.residentLv201AccountId, fixtureDb.staffElectric1AccountId, 1, "Needs improvement in LV.", createdAt);
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
  assert.doesNotMatch(residentRatingsHtml, /Electric Staff Two/);
  assert.doesNotMatch(residentRatingsHtml, /Great work in LV\./);
  assert.doesNotMatch(residentRatingsHtml, /Excellent work in PM\./);

  const residentStaffDetail = await fixture.app.fetch(
    new Request(`http://helpdesk.local/resident/staff-ratings/${fixtureDb.staffElectric1AccountId}`, {
      headers: { cookie: residentPalm.cookiePair },
    }),
  );
  assert.equal(residentStaffDetail.status, 200);
  const residentStaffDetailHtml = await residentStaffDetail.text();
  assert.match(residentStaffDetailHtml, /Excellent work in PM\./);
  assert.doesNotMatch(residentStaffDetailHtml, /Needs improvement in LV\./);
  assert.doesNotMatch(residentStaffDetailHtml, /Great work in LV\./);

  const adminPalm = await loginAndSession(fixture.app, "admin_pm", "/admin");
  const adminApartmentRatings = await fixture.app.fetch(
    new Request("http://helpdesk.local/admin/staff", {
      headers: { cookie: adminPalm.cookiePair },
    }),
  );
  assert.equal(adminApartmentRatings.status, 200);
  const adminApartmentHtml = await adminApartmentRatings.text();
  assert.match(adminApartmentHtml, /Excellent work in PM\./);
  assert.doesNotMatch(adminApartmentHtml, /Needs improvement in LV\./);
  assert.doesNotMatch(adminApartmentHtml, /Platform Average Rating/i);
  assert.doesNotMatch(adminApartmentHtml, /Great work in LV\./);

  const adminPlatformToggle = await fixture.app.fetch(
    new Request("http://helpdesk.local/admin/staff?show_platform=1", {
      headers: { cookie: adminPalm.cookiePair },
    }),
  );
  assert.equal(adminPlatformToggle.status, 200);
  const adminPlatformHtml = await adminPlatformToggle.text();
  assert.match(adminPlatformHtml, /Electric Staff One/);
  assert.doesNotMatch(adminPlatformHtml, /Electric Staff Two/);
  assert.match(adminPlatformHtml, /Apartment Average Rating/i);
  assert.match(adminPlatformHtml, /Platform Average Rating/i);
  assert.match(adminPlatformHtml, /Apartment Rating Count/i);
  assert.match(adminPlatformHtml, /Platform Rating Count/i);
  assert.match(adminPlatformHtml, /Excellent work in PM\./);
  assert.doesNotMatch(adminPlatformHtml, /Needs improvement in LV\./);
  assert.doesNotMatch(adminPlatformHtml, /Great work in LV\./);

  fixture.close();
  fixtureDb.cleanup();
});

test("GET /500 renders role-aware home link and retry option", async () => {
  const fixtureDb = createFixtureDb();
  const fixture = createFixtureApp(fixtureDb.sqlitePath);

  const resident = await loginAndSession(fixture.app, "resident_flat101", "/resident");
  const residentError = await fixture.app.fetch(
    new Request("http://helpdesk.local/500", {
      headers: { cookie: resident.cookiePair },
    }),
  );
  assert.equal(residentError.status, 500);
  const residentHtml = await residentError.text();
  assert.match(residentHtml, /href="\/resident"/);
  assert.match(residentHtml, /Go to Resident Home \(All Tickets\)/);
  assert.match(residentHtml, /Retry Current Page/);

  const unauthError = await fixture.app.fetch(new Request("http://helpdesk.local/500"));
  assert.equal(unauthError.status, 500);
  const unauthHtml = await unauthError.text();
  assert.match(unauthHtml, /href="\/"/);
  assert.match(unauthHtml, /Go to Helpdesk/);

  fixture.close();
  fixtureDb.cleanup();
});

test("request and mutation logging emit structured records", async () => {
  const fixtureDb = createFixtureDb();
  const fixture = createFixtureApp(fixtureDb.sqlitePath);

  const capturedLogs = [];
  const originalConsoleLog = console.log;
  console.log = (...args) => {
    capturedLogs.push(args.join(" "));
  };

  try {
    const resident = await loginAndSession(fixture.app, "resident_flat101", "/resident");
    const createResponse = await fixture.app.fetch(
      buildFormRequest(
        "http://helpdesk.local/tickets",
        {
          csrf_token: resident.csrfToken,
          issue_type: "electrical",
          title: "Socket sparks in bedroom",
          description: "The bedroom socket sparks when plugging the charger and needs urgent repair.",
        },
        resident.cookiePair,
      ),
    );
    assert.equal(createResponse.status, 303);
  } finally {
    console.log = originalConsoleLog;
  }

  const structuredLogs = capturedLogs
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const requestLog = structuredLogs.find(
    (entry) => entry.event === "request" && entry.route === "/tickets" && entry.status === 303,
  );
  assert.ok(requestLog);
  assert.equal(typeof requestLog.request_id, "string");
  assert.ok(requestLog.request_id.length > 0);
  assert.equal(requestLog.actor?.role, "resident");
  assert.equal(typeof requestLog.duration_ms, "number");
  assert.ok(requestLog.duration_ms >= 0);

  const mutationLog = structuredLogs.find(
    (entry) => entry.event === "mutation" && entry.action === "ticket_created",
  );
  assert.ok(mutationLog);
  assert.equal(typeof mutationLog.request_id, "string");
  assert.equal(mutationLog.actor?.role, "resident");
  assert.equal(typeof mutationLog.ticket_id, "number");

  fixture.close();
  fixtureDb.cleanup();
});
