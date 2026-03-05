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

test("milestone 4+ migration adds staff apartment links and schema advances", () => {
  const { sqlitePath, cleanup } = createFixtureDb();
  const db = new DatabaseSync(sqlitePath);

  const rows = db
    .prepare(
      "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name",
    )
    .all();
  const tableNames = rows.map((row) => row.name);

  assert.ok(tableNames.includes("staff_apartment_links"));

  const schemaVersion = db.prepare("select value from meta where key = 'schema_version'").get().value;
  assert.ok(Number(schemaVersion) >= 4);

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

test("admin can reassign ticket while status is assigned", async () => {
  const fixtureDb = createFixtureDb();
  const ticketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-100011",
    issueType: "electrical",
  });
  linkStaffToApartment({
    sqlitePath: fixtureDb.sqlitePath,
    staffAccountId: fixtureDb.staffElectric2AccountId,
    apartmentId: fixtureDb.apartmentPalmId,
  });

  const fixture = createFixtureApp(fixtureDb.sqlitePath);
  const { cookiePair, csrfToken } = await loginAndSession(fixture.app, "admin_pm", "/admin");

  const firstAssign = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/assign`,
      {
        csrf_token: csrfToken,
        staff_account_id: String(fixtureDb.staffElectric1AccountId),
      },
      cookiePair,
    ),
  );
  assert.equal(firstAssign.status, 303);

  const reassign = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/assign`,
      {
        csrf_token: csrfToken,
        staff_account_id: String(fixtureDb.staffElectric2AccountId),
      },
      cookiePair,
    ),
  );
  assert.equal(reassign.status, 303);

  const db = new DatabaseSync(fixtureDb.sqlitePath);
  const ticket = db
    .prepare("select status, assigned_staff_account_id from tickets where id = ?")
    .get(ticketId);
  assert.equal(ticket.status, "assigned");
  assert.equal(ticket.assigned_staff_account_id, fixtureDb.staffElectric2AccountId);
  const reassignedCount = db
    .prepare("select count(*) as count from ticket_events where ticket_id = ? and event_type = 'reassigned'")
    .get(ticketId).count;
  assert.equal(reassignedCount, 1);
  db.close();

  fixture.close();
  fixtureDb.cleanup();
});

test("admin can reassign ticket while status is in_progress", async () => {
  const fixtureDb = createFixtureDb();
  const ticketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-100012",
    issueType: "electrical",
    status: "in_progress",
    assignedStaffAccountId: fixtureDb.staffElectric1AccountId,
  });
  linkStaffToApartment({
    sqlitePath: fixtureDb.sqlitePath,
    staffAccountId: fixtureDb.staffElectric2AccountId,
    apartmentId: fixtureDb.apartmentPalmId,
  });

  const fixture = createFixtureApp(fixtureDb.sqlitePath);
  const { cookiePair, csrfToken } = await loginAndSession(fixture.app, "admin_pm", "/admin");

  const reassign = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/assign`,
      {
        csrf_token: csrfToken,
        staff_account_id: String(fixtureDb.staffElectric2AccountId),
      },
      cookiePair,
    ),
  );
  assert.equal(reassign.status, 303);

  const db = new DatabaseSync(fixtureDb.sqlitePath);
  const ticket = db
    .prepare("select status, assigned_staff_account_id from tickets where id = ?")
    .get(ticketId);
  assert.equal(ticket.status, "in_progress");
  assert.equal(ticket.assigned_staff_account_id, fixtureDb.staffElectric2AccountId);
  const reassignedCount = db
    .prepare("select count(*) as count from ticket_events where ticket_id = ? and event_type = 'reassigned'")
    .get(ticketId).count;
  assert.equal(reassignedCount, 1);
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
  const adminHtml = await adminResponse.text();
  assert.match(adminHtml, /href="\/admin"/);
  assert.match(adminHtml, /<nav class="top-nav top-nav--with-ticket-center">/);
  assert.match(adminHtml, /@media \(max-width: 420px\) \{ \.top-nav\.top-nav--with-ticket-center \.nav-ticket-center \{ position: absolute;/);

  const staffAssigned = await loginAndSession(fixture.app, "staff_electric_1", "/staff");
  const staffResponse = await fixture.app.fetch(
    new Request(`http://helpdesk.local/tickets/${ticketId}`, {
      headers: { cookie: staffAssigned.cookiePair },
    }),
  );
  assert.equal(staffResponse.status, 200);
  assert.match(await staffResponse.text(), /href="\/staff"/);

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

  const comments = db
    .prepare("select count(*) as total from ticket_comments where ticket_id = ?")
    .get(ticketId);
  assert.equal(comments.total, 0);

  db.close();

  fixture.close();
  fixtureDb.cleanup();
});

test("admin can complete assigned and in_progress tickets with cancellation reason", async () => {
  const fixtureDb = createFixtureDb();
  const assignedTicketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-100016",
    status: "assigned",
    assignedStaffAccountId: fixtureDb.staffElectric1AccountId,
  });
  const inProgressTicketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident102AccountId,
    flatNumber: "102",
    ticketNumber: "PM-100017",
    status: "in_progress",
    assignedStaffAccountId: fixtureDb.staffElectric1AccountId,
  });

  const fixture = createFixtureApp(fixtureDb.sqlitePath);
  const admin = await loginAndSession(fixture.app, "admin_pm", "/admin");

  const assignedComplete = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${assignedTicketId}/status`,
      {
        csrf_token: admin.csrfToken,
        next_status: "completed",
        cancel_reason: "Completed by admin due to duplicate (assigned state).",
      },
      admin.cookiePair,
    ),
  );
  assert.equal(assignedComplete.status, 303);

  const inProgressComplete = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${inProgressTicketId}/status`,
      {
        csrf_token: admin.csrfToken,
        next_status: "completed",
        cancel_reason: "Completed by admin due to duplicate (in progress state).",
      },
      admin.cookiePair,
    ),
  );
  assert.equal(inProgressComplete.status, 303);

  const db = new DatabaseSync(fixtureDb.sqlitePath);
  for (const ticketId of [assignedTicketId, inProgressTicketId]) {
    const ticket = db
      .prepare("select status, completed_by_admin_cancel from tickets where id = ?")
      .get(ticketId);
    assert.equal(ticket.status, "completed");
    assert.equal(ticket.completed_by_admin_cancel, 1);
  }
  const eventCount = db
    .prepare("select count(*) as count from ticket_events where ticket_id in (?, ?) and event_type = 'admin_completed_cancel'")
    .get(assignedTicketId, inProgressTicketId).count;
  assert.equal(eventCount, 2);
  db.close();

  fixture.close();
  fixtureDb.cleanup();
});

test("ticket detail actions are hidden when not applicable for admin and staff", async () => {
  const fixtureDb = createFixtureDb();
  const assignedTicketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-100020",
    status: "assigned",
    assignedStaffAccountId: fixtureDb.staffElectric1AccountId,
  });
  const completedTicketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-100021",
    status: "completed",
    assignedStaffAccountId: fixtureDb.staffElectric1AccountId,
  });

  const fixture = createFixtureApp(fixtureDb.sqlitePath);

  const admin = await loginAndSession(fixture.app, "admin_pm", "/admin");
  const assignedAdminDetail = await fixture.app.fetch(
    new Request(`http://helpdesk.local/tickets/${assignedTicketId}`, {
      headers: { cookie: admin.cookiePair },
    }),
  );
  assert.equal(assignedAdminDetail.status, 200);
  const assignedAdminHtml = await assignedAdminDetail.text();
  assert.match(assignedAdminHtml, /<h2>Actions<\/h2>/);
  assert.doesNotMatch(assignedAdminHtml, /Save Assignment/);
  assert.match(assignedAdminHtml, /Comment and Close/);
  assert.match(assignedAdminHtml, /Just Comment/);

  const completedAdminDetail = await fixture.app.fetch(
    new Request(`http://helpdesk.local/tickets/${completedTicketId}`, {
      headers: { cookie: admin.cookiePair },
    }),
  );
  assert.equal(completedAdminDetail.status, 200);
  const completedAdminHtml = await completedAdminDetail.text();
  assert.doesNotMatch(completedAdminHtml, /<h2>Actions<\/h2>/);
  assert.doesNotMatch(completedAdminHtml, /Save Assignment/);
  assert.doesNotMatch(completedAdminHtml, /Comment and Close/);
  assert.doesNotMatch(completedAdminHtml, /Just Comment/);

  const staff = await loginAndSession(fixture.app, "staff_electric_1", "/staff");
  const completedStaffDetail = await fixture.app.fetch(
    new Request(`http://helpdesk.local/tickets/${completedTicketId}`, {
      headers: { cookie: staff.cookiePair },
    }),
  );
  assert.equal(completedStaffDetail.status, 200);
  const completedStaffHtml = await completedStaffDetail.text();
  assert.doesNotMatch(completedStaffHtml, /<h2>Actions<\/h2>/);
  assert.doesNotMatch(completedStaffHtml, /Update Status/);

  fixture.close();
  fixtureDb.cleanup();
});

test("admin ticket detail uses one note box with two action buttons for comment flows", async () => {
  const fixtureDb = createFixtureDb();
  const ticketId = insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-100022",
    status: "open",
  });

  const fixture = createFixtureApp(fixtureDb.sqlitePath);
  const admin = await loginAndSession(fixture.app, "admin_pm", "/admin");

  const detailResponse = await fixture.app.fetch(
    new Request(`http://helpdesk.local/tickets/${ticketId}`, {
      headers: { cookie: admin.cookiePair },
    }),
  );
  assert.equal(detailResponse.status, 200);
  const detailHtml = await detailResponse.text();
  assert.match(detailHtml, /<textarea id="admin_note" name="admin_note" required>/);
  assert.match(detailHtml, /<button type="submit" class="wide-button button-danger">Comment and Close<\/button>/);
  assert.match(detailHtml, /<button type="submit" class="wide-button button-secondary" formaction="\/tickets\/\d+\/comments">Just Comment<\/button>/);

  const justCommentResponse = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/comments`,
      {
        csrf_token: admin.csrfToken,
        admin_note: "Admin quick note from shared box.",
      },
      admin.cookiePair,
    ),
  );
  assert.equal(justCommentResponse.status, 303);

  const commentAndCloseResponse = await fixture.app.fetch(
    buildFormRequest(
      `http://helpdesk.local/tickets/${ticketId}/status`,
      {
        csrf_token: admin.csrfToken,
        next_status: "completed",
        admin_note: "Closing via shared box.",
      },
      admin.cookiePair,
    ),
  );
  assert.equal(commentAndCloseResponse.status, 303);

  const db = new DatabaseSync(fixtureDb.sqlitePath);
  const ticket = db.prepare("select status from tickets where id = ?").get(ticketId);
  assert.equal(ticket.status, "completed");
  const comments = db
    .prepare("select comment_text from ticket_comments where ticket_id = ? order by id asc")
    .all(ticketId);
  assert.equal(comments.length, 1);
  assert.equal(comments[0].comment_text, "Admin quick note from shared box.");
  const closeEvent = db
    .prepare("select note_text from ticket_events where ticket_id = ? and event_type = 'admin_completed_cancel' order by id desc limit 1")
    .get(ticketId);
  assert.equal(closeEvent.note_text, "Closing via shared box.");
  db.close();

  fixture.close();
  fixtureDb.cleanup();
});

test("admin home supports queue filters, pagination, and aging highlights", async () => {
  const fixtureDb = createFixtureDb();
  insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-200001",
    issueType: "electrical",
    title: "Open A aged",
    status: "open",
    createdAt: hoursAgoIso(48),
    updatedAt: hoursAgoIso(47),
  });
  insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-200002",
    issueType: "electrical",
    title: "Open B recent",
    status: "open",
  });
  insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident101AccountId,
    flatNumber: "101",
    ticketNumber: "PM-200003",
    issueType: "electrical",
    title: "Open C recent",
    status: "open",
  });
  insertTicket({
    sqlitePath: fixtureDb.sqlitePath,
    apartmentId: fixtureDb.apartmentPalmId,
    residentAccountId: fixtureDb.resident102AccountId,
    flatNumber: "102",
    ticketNumber: "PM-200004",
    issueType: "plumbing",
    title: "In Progress old",
    status: "in_progress",
    assignedStaffAccountId: fixtureDb.staffPlumber1AccountId,
    createdAt: hoursAgoIso(90),
    updatedAt: hoursAgoIso(80),
    assignedAt: hoursAgoIso(88),
    inProgressAt: hoursAgoIso(78),
  });

  const fixture = createFixtureApp(fixtureDb.sqlitePath);
  const admin = await loginAndSession(fixture.app, "admin_pm", "/admin");

  const homeResponse = await fixture.app.fetch(
    new Request("http://helpdesk.local/admin", {
      headers: { cookie: admin.cookiePair },
    }),
  );
  assert.equal(homeResponse.status, 200);
  const homeHtml = await homeResponse.text();
  assert.match(homeHtml, /Unassigned tickets older than 24h:<\/strong>\s*1/i);
  assert.match(homeHtml, /In-progress tickets older than 72h:<\/strong>\s*1/i);
  assert.match(homeHtml, /name="status"/);
  assert.match(homeHtml, /name="issue_type"/);
  assert.match(homeHtml, /name="assigned_staff"/);
  assert.match(homeHtml, /ticket-meta-chip--updated/);
  assert.match(homeHtml, /Updated [0-9]+[mhd] ago/);

  const filteredPage1 = await fixture.app.fetch(
    new Request("http://helpdesk.local/admin?status=open&issue_type=electrical&assigned_staff=unassigned&page_size=2&page=1", {
      headers: { cookie: admin.cookiePair },
    }),
  );
  assert.equal(filteredPage1.status, 200);
  const filteredPage1Html = await filteredPage1.text();
  assert.match(filteredPage1Html, /Open C recent/);
  assert.match(filteredPage1Html, /Open B recent/);
  assert.doesNotMatch(filteredPage1Html, /Open A aged/);
  assert.match(filteredPage1Html, /Page 1 of 2/i);

  const filteredPage2 = await fixture.app.fetch(
    new Request("http://helpdesk.local/admin?status=open&issue_type=electrical&assigned_staff=unassigned&page_size=2&page=2", {
      headers: { cookie: admin.cookiePair },
    }),
  );
  assert.equal(filteredPage2.status, 200);
  const filteredPage2Html = await filteredPage2.text();
  assert.match(filteredPage2Html, /Open A aged/);
  assert.doesNotMatch(filteredPage2Html, /Open C recent/);
  assert.match(filteredPage2Html, /Page 2 of 2/i);

  const assignedFilter = await fixture.app.fetch(
    new Request(`http://helpdesk.local/admin?assigned_staff=${fixtureDb.staffPlumber1AccountId}`, {
      headers: { cookie: admin.cookiePair },
    }),
  );
  assert.equal(assignedFilter.status, 200);
  const assignedFilterHtml = await assignedFilter.text();
  assert.match(assignedFilterHtml, /In Progress old/);
  assert.doesNotMatch(assignedFilterHtml, /Open C recent/);

  fixture.close();
  fixtureDb.cleanup();
});
