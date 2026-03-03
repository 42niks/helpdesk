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

test("admin and assigned staff can add comments while ticket is active", async () => {
  const fixtureDb = createFixtureDb();
  const ticketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-100013",
    status: "assigned",
    assignedStaffAccountId: fixtureDb.staffElectric1AccountId,
  });

  const fixture = createFixtureApp(fixtureDb.sqlitePath);

  const admin = await loginAndSession(fixture.app, "admin_pm", "/admin");
  const adminComment = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/comments`,
      {
        csrf_token: admin.csrfToken,
        comment_text: "Admin note: resident requested evening visit.",
      },
      admin.cookiePair,
    ),
  );
  assert.equal(adminComment.status, 303);

  const staff = await loginAndSession(fixture.app, "staff_electric_1", "/staff");
  const staffComment = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/comments`,
      {
        csrf_token: staff.csrfToken,
        comment_text: "Staff note: carrying spare switchboard kit.",
      },
      staff.cookiePair,
    ),
  );
  assert.equal(staffComment.status, 303);

  const db = new DatabaseSync(fixtureDb.sqlitePath);
  const comments = db
    .prepare("select author_role, comment_text from ticket_comments where ticket_id = ? order by id asc")
    .all(ticketId);
  assert.equal(comments.length, 2);
  assert.equal(comments[0].author_role, "admin");
  assert.equal(comments[1].author_role, "staff");
  db.close();

  fixture.close();
  fixtureDb.cleanup();
});

test("admin and assigned staff comments are blocked after ticket completion", async () => {
  const fixtureDb = createFixtureDb();
  const ticketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-100014",
    status: "completed",
    assignedStaffAccountId: fixtureDb.staffElectric1AccountId,
  });

  const fixture = createFixtureApp(fixtureDb.sqlitePath);

  const admin = await loginAndSession(fixture.app, "admin_pm", "/admin");
  const adminComment = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/comments`,
      {
        csrf_token: admin.csrfToken,
        comment_text: "Admin should not be able to comment after completion.",
      },
      admin.cookiePair,
    ),
  );
  assert.equal(adminComment.status, 409);

  const staff = await loginAndSession(fixture.app, "staff_electric_1", "/staff");
  const staffComment = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/comments`,
      {
        csrf_token: staff.csrfToken,
        comment_text: "Staff should not be able to comment after completion.",
      },
      staff.cookiePair,
    ),
  );
  assert.equal(staffComment.status, 409);

  const db = new DatabaseSync(fixtureDb.sqlitePath);
  const commentCount = db
    .prepare("select count(*) as count from ticket_comments where ticket_id = ?")
    .get(ticketId).count;
  assert.equal(commentCount, 0);
  db.close();

  fixture.close();
  fixtureDb.cleanup();
});

test("non-assigned staff gets 404 for comment and status mutations", async () => {
  const fixtureDb = createFixtureDb();
  const ticketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-100015",
    status: "assigned",
    assignedStaffAccountId: fixtureDb.staffElectric1AccountId,
  });

  const fixture = createFixtureApp(fixtureDb.sqlitePath);
  const staffOther = await loginAndSession(fixture.app, "staff_plumber_1", "/staff");

  const commentResponse = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/comments`,
      {
        csrf_token: staffOther.csrfToken,
        comment_text: "Unauthorized comment attempt.",
      },
      staffOther.cookiePair,
    ),
  );
  assert.equal(commentResponse.status, 404);

  const statusResponse = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/status`,
      {
        csrf_token: staffOther.csrfToken,
        next_status: "in_progress",
      },
      staffOther.cookiePair,
    ),
  );
  assert.equal(statusResponse.status, 404);

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

test("resident review accepts empty review and rating-only review", async () => {
  const fixtureDb = createFixtureDb();
  const emptyReviewTicketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-100018",
    status: "completed",
    assignedStaffAccountId: fixtureDb.staffElectric1AccountId,
  });
  const ratingOnlyTicketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-100019",
    status: "completed",
    assignedStaffAccountId: fixtureDb.staffElectric1AccountId,
  });

  const fixture = createFixtureApp(fixtureDb.sqlitePath);
  const resident = await loginAndSession(fixture.app, "resident_flat101", "/resident");

  const firstDetail = await fixture.app.fetch(
    new Request(`http://helpdesk.local/tickets/${emptyReviewTicketId}`, {
      headers: { cookie: resident.cookiePair },
    }),
  );
  const firstDetailCsrf = extractCsrfToken(await firstDetail.text());

  const emptyReviewResponse = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${emptyReviewTicketId}/review`,
      {
        csrf_token: firstDetailCsrf,
      },
      resident.cookiePair,
    ),
  );
  assert.equal(emptyReviewResponse.status, 303);

  const ratingOnlyReviewResponse = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ratingOnlyTicketId}/review`,
      {
        csrf_token: firstDetailCsrf,
        rating: "4",
      },
      resident.cookiePair,
    ),
  );
  assert.equal(ratingOnlyReviewResponse.status, 303);

  const db = new DatabaseSync(fixtureDb.sqlitePath);
  const emptyReview = db
    .prepare("select rating, review_text from ticket_reviews where ticket_id = ?")
    .get(emptyReviewTicketId);
  assert.equal(emptyReview.rating, null);
  assert.equal(emptyReview.review_text, null);

  const ratingOnlyReview = db
    .prepare("select rating, review_text from ticket_reviews where ticket_id = ?")
    .get(ratingOnlyTicketId);
  assert.equal(ratingOnlyReview.rating, 4);
  assert.equal(ratingOnlyReview.review_text, null);
  db.close();

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

test("resident review is blocked until ticket is completed", async () => {
  const fixtureDb = createFixtureDb();
  const ticketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-100020",
    status: "in_progress",
    assignedStaffAccountId: fixtureDb.staffElectric1AccountId,
  });

  const fixture = createFixtureApp(fixtureDb.sqlitePath);
  const resident = await loginAndSession(fixture.app, "resident_flat101", "/resident");

  const detailResponse = await fixture.app.fetch(
    new Request(`http://helpdesk.local/tickets/${ticketId}`, {
      headers: { cookie: resident.cookiePair },
    }),
  );
  const csrfToken = extractCsrfToken(await detailResponse.text());

  const reviewResponse = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/review`,
      {
        csrf_token: csrfToken,
        rating: "5",
        review_text: "Attempting review before completion should fail.",
      },
      resident.cookiePair,
    ),
  );
  assert.equal(reviewResponse.status, 409);
  const reviewHtml = await reviewResponse.text();
  assert.doesNotMatch(reviewHtml, /\/review" novalidate/);
  assert.match(reviewHtml, /Status:<\/strong>\s*In Progress/i);

  fixture.close();
  fixtureDb.cleanup();
});

test("submitted review appears on admin and assigned staff ticket detail", async () => {
  const fixtureDb = createFixtureDb();
  const ticketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-100010",
    status: "completed",
    assignedStaffAccountId: fixtureDb.staffElectric1AccountId,
  });

  const db = new DatabaseSync(fixtureDb.sqlitePath);
  db.prepare(
    [
      "insert into ticket_reviews (ticket_id, resident_account_id, staff_account_id, rating, review_text, created_at)",
      "values (?, ?, ?, ?, ?, ?)",
    ].join(" "),
  ).run(ticketId, fixtureDb.resident101AccountId, fixtureDb.staffElectric1AccountId, 5, "Review visible to all authorized viewers.", nowIso());
  db.close();

  const fixture = createFixtureApp(fixtureDb.sqlitePath);

  const admin = await loginAndSession(fixture.app, "admin_pm", "/admin");
  const adminDetail = await fixture.app.fetch(
    new Request(`http://helpdesk.local/tickets/${ticketId}`, {
      headers: { cookie: admin.cookiePair },
    }),
  );
  assert.equal(adminDetail.status, 200);
  const adminHtml = await adminDetail.text();
  assert.match(adminHtml, /Submitted Review/);
  assert.match(adminHtml, /Review visible to all authorized viewers\./);

  const staff = await loginAndSession(fixture.app, "staff_electric_1", "/staff");
  const staffDetail = await fixture.app.fetch(
    new Request(`http://helpdesk.local/tickets/${ticketId}`, {
      headers: { cookie: staff.cookiePair },
    }),
  );
  assert.equal(staffDetail.status, 200);
  const staffHtml = await staffDetail.text();
  assert.match(staffHtml, /Submitted Review/);
  assert.match(staffHtml, /Review visible to all authorized viewers\./);

  fixture.close();
  fixtureDb.cleanup();
});

