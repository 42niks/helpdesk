import {
  createCsrfToken,
  createSessionToken,
  hashSessionToken,
  verifyPassword,
} from "./security.mjs";
import {
  validateCommentInput,
  validateReviewInput,
  validateTicketCreateInput,
} from "./tickets-validation.mjs";

const RUNTIME_ENV = globalThis.process?.env || {};
const SESSION_COOKIE_NAME = RUNTIME_ENV.SESSION_COOKIE_NAME || "helpdesk_session";
const SESSION_TTL_HOURS = Number.parseInt(RUNTIME_ENV.SESSION_TTL_HOURS || "168", 10);

function now() {
  return new Date();
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function htmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseCookies(rawCookie) {
  const cookies = {};
  if (!rawCookie) {
    return cookies;
  }
  for (const part of rawCookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (!name) {
      continue;
    }
    cookies[name] = rest.join("=");
  }
  return cookies;
}

function baseHeaders() {
  return {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  };
}

function text(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function doc(title, body) {
  return [
    "<!doctype html>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${htmlEscape(title)}</title>`,
    "<style>",
    ":root { color-scheme: light; }",
    "body { margin: 0; padding: 0; font-family: Arial, sans-serif; background: #f5f7fa; color: #111; }",
    "main { max-width: min(480px, 100vw); margin: 0 auto; min-height: 100vh; box-sizing: border-box; padding: 16px; background: #fff; }",
    "h1 { font-size: 1.4rem; margin: 0 0 12px; }",
    "h2 { font-size: 1.15rem; margin: 20px 0 8px; }",
    "p { margin: 8px 0; line-height: 1.45; }",
    "nav { margin: 0 0 16px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }",
    "nav form { margin: 0; }",
    "a { color: #0b5fff; text-decoration: underline; }",
    "label { display: block; font-weight: 600; margin: 8px 0 4px; }",
    'input[type="text"], input[type="password"], select, textarea { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; font-family: inherit; }',
    "textarea { min-height: 120px; resize: vertical; }",
    "button { margin-top: 0; width: auto; padding: 10px 12px; border: 1px solid #111; border-radius: 4px; background: #111; color: #fff; font-size: 1rem; }",
    ".wide-button { width: 100%; margin-top: 12px; }",
    ".nav-button { padding: 6px 10px; font-size: 0.9rem; }",
    ".action-form { margin: 12px 0; }",
    ".inline-form { margin: 0; }",
    ".resident-meta { margin: 10px 0 12px; padding: 10px; background: #f7f9fc; border: 1px solid #dfe7f2; border-radius: 4px; }",
    ".resident-meta p { margin: 4px 0; }",
    ".message { padding: 10px; border-radius: 4px; margin: 12px 0; }",
    ".message.info { background: #eef3ff; border: 1px solid #c7d8ff; }",
    ".message.error { background: #fff0f0; border: 1px solid #f3c0c0; }",
    ".field-error { margin: 6px 0 0; color: #a40000; font-size: 0.95rem; }",
    ".ticket-list, .timeline, .comment-list { list-style: none; margin: 12px 0; padding: 0; display: grid; gap: 10px; }",
    ".ticket-item, .timeline-item, .comment-item { border: 1px solid #dfe7f2; border-radius: 4px; padding: 10px; background: #fff; }",
    ".ticket-item h3 { margin: 0 0 6px; font-size: 1.05rem; }",
    ".meta-row { margin: 4px 0; }",
    ".small { color: #444; font-size: 0.95rem; }",
    "pre { overflow: auto; white-space: pre-wrap; background: #f1f1f1; padding: 12px; border-radius: 4px; }",
    "</style>",
    `<main>${body}</main>`,
  ].join("");
}

function html(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      ...baseHeaders(),
      ...headers,
    },
  });
}

function roleHome(role) {
  if (role === "resident") {
    return "/resident";
  }
  if (role === "admin") {
    return "/admin";
  }
  return "/staff";
}

function roleHomeLabel(role) {
  if (role === "resident") {
    return "Go to Resident Home (All Tickets)";
  }
  if (role === "admin") {
    return "Go to Admin Home (All Tickets)";
  }
  if (role === "staff") {
    return "Go to Staff Home (Assigned Tickets)";
  }
  return "Go to Helpdesk";
}

function sessionCookie(token, environment) {
  const secure = environment === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

function clearSessionCookie(environment) {
  const secure = environment === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`;
}

function redirect(location, extraHeaders = {}) {
  return new Response(null, {
    status: 303,
    headers: {
      "cache-control": "no-store",
      location,
      ...extraHeaders,
    },
  });
}

function requestId() {
  return crypto.randomUUID();
}

function loginBanner(reason) {
  if (reason === "expired") {
    return '<div class="message info">Session expired. Please log in again.</div>';
  }
  if (reason === "logged_out") {
    return '<div class="message info">You have been logged out.</div>';
  }
  return "";
}

function loginPage({ reason = "", authError = "" }) {
  const errorHtml = authError
    ? `<div class="message error">${htmlEscape(authError)}</div>`
    : "";
  return doc(
    "Helpdesk",
    [
      "<h1>Helpdesk</h1>",
      loginBanner(reason),
      errorHtml,
      '<form method="post" action="/login" novalidate>',
      '<label for="username">Username</label>',
      '<input id="username" name="username" type="text" autocomplete="username" required>',
      '<label for="password">Password</label>',
      '<input id="password" name="password" type="password" autocomplete="current-password" required>',
      '<button type="submit" class="wide-button">Login</button>',
      "</form>",
    ].join(""),
  );
}

function navWithLogout({ csrfToken, links }) {
  const navLinks = links
    .map((entry) => `<a href="${entry.href}">${entry.label}</a>`)
    .join("");
  return [
    "<nav>",
    '<form method="post" action="/logout">',
    `<input type="hidden" name="csrf_token" value="${htmlEscape(csrfToken)}">`,
    '<button type="submit" class="nav-button">Logout</button>',
    "</form>",
    navLinks,
    "</nav>",
  ].join("");
}

function pageWithLogout({
  title,
  welcomeText,
  links,
  csrfToken,
  detailsHtml = "",
  primaryAction = null,
}) {
  const actionHtml = primaryAction
    ? [
      `<form class="action-form" method="${primaryAction.method || "get"}" action="${primaryAction.href}">`,
      `<button type="submit" class="wide-button">${htmlEscape(primaryAction.label)}</button>`,
      "</form>",
    ].join("")
    : "";
  return doc(
    title,
    [
      navWithLogout({ csrfToken, links }),
      `<h1>${htmlEscape(title)}</h1>`,
      `<p>${htmlEscape(welcomeText)}</p>`,
      detailsHtml,
      actionHtml,
      '<p class="small">Milestone 2 is active: resident ticket create/list/detail/comment thin slice.</p>',
    ].join(""),
  );
}

function errorPage({ status, title, message, role, includeRetry, retryHref, details, requestIdValue }) {
  const homeHref = role ? roleHome(role) : "/";
  const homeLabel = roleHomeLabel(role);
  const retryHtml = includeRetry
    ? `<a href="${htmlEscape(retryHref)}">Retry Current Page</a>`
    : "";
  const detailsHtml = details
    ? `<h2>Error Details</h2><pre>${htmlEscape(details)}</pre>`
    : "";
  return html(
    doc(
      title,
      [
        `<nav><a href="${homeHref}">${homeLabel}</a>${retryHtml}</nav>`,
        `<h1>${htmlEscape(title)}</h1>`,
        `<p>${htmlEscape(message)}</p>`,
        `<p class="small">Request ID: ${htmlEscape(requestIdValue)}</p>`,
        detailsHtml,
      ].join(""),
    ),
    status,
  );
}

async function parseForm(request) {
  const formData = await request.formData();
  const values = {};
  for (const [key, value] of formData.entries()) {
    values[key] = typeof value === "string" ? value : "";
  }
  return values;
}

function issueTypeLabel(issueType) {
  if (issueType === "electrical") {
    return "Electrical";
  }
  if (issueType === "plumbing") {
    return "Plumbing";
  }
  return "Unknown";
}

function issueTypeToStaffType(issueType) {
  if (issueType === "electrical") {
    return "electrician";
  }
  if (issueType === "plumbing") {
    return "plumber";
  }
  return "";
}

function staffTypeLabel(staffType) {
  if (staffType === "electrician") {
    return "Electrician";
  }
  if (staffType === "plumber") {
    return "Plumber";
  }
  return "Unknown";
}

function statusLabel(status) {
  if (status === "open") {
    return "Open";
  }
  if (status === "assigned") {
    return "Assigned";
  }
  if (status === "in_progress") {
    return "In Progress";
  }
  if (status === "completed") {
    return "Completed";
  }
  return "Unknown";
}

function formatTicketNumber(apartmentCode, ticketId) {
  return `${apartmentCode}-${String(ticketId).padStart(6, "0")}`;
}

function parsePositiveInt(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function ratingLabel(rating) {
  if (!Number.isInteger(rating)) {
    return "N/A";
  }
  return `${rating}/5`;
}

function formatAverageRating(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "N/A";
  }
  return Number(value).toFixed(2);
}

function parseTicketId(pathname, pattern) {
  const match = pathname.match(pattern);
  if (!match) {
    return null;
  }
  const ticketId = Number.parseInt(match[1], 10);
  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    return null;
  }
  return ticketId;
}

async function findAccountForLogin(db, username) {
  return db.get(
    [
      "select id, username, password_hash, role, is_active",
      "from accounts",
      "where username = ? collate nocase",
      "limit 1",
    ].join(" "),
    [username],
  );
}

function isSessionExpired(expiresAt, nowValue) {
  const expiresAtTime = Date.parse(expiresAt);
  if (Number.isNaN(expiresAtTime)) {
    return true;
  }
  return expiresAtTime <= nowValue.getTime();
}

async function getSession(db, token) {
  if (!token) {
    return null;
  }
  const tokenHash = await hashSessionToken(token);
  const row = await db.get(
    [
      "select s.id as session_id, s.account_id, s.csrf_token, s.expires_at, s.revoked_at,",
      "a.role as role, a.username as username, a.is_active as account_is_active",
      "from sessions s",
      "join accounts a on a.id = s.account_id",
      "where s.token_hash = ?",
      "limit 1",
    ].join(" "),
    [tokenHash],
  );
  if (!row) {
    return null;
  }
  return {
    sessionId: row.session_id,
    accountId: row.account_id,
    csrfToken: row.csrf_token,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    role: row.role,
    username: row.username,
    accountIsActive: row.account_is_active === 1,
  };
}

async function touchSession(db, session, currentTime) {
  const nowIso = currentTime.toISOString();
  const nextExpiry = addHours(currentTime, SESSION_TTL_HOURS).toISOString();
  await db.run(
    [
      "update sessions",
      "set last_seen_at = ?, updated_at = ?, expires_at = ?",
      "where id = ?",
    ].join(" "),
    [nowIso, nowIso, nextExpiry, session.sessionId],
  );
}

async function revokeSession(db, sessionId, currentTime) {
  const nowIso = currentTime.toISOString();
  await db.run(
    [
      "update sessions",
      "set revoked_at = ?, updated_at = ?",
      "where id = ? and revoked_at is null",
    ].join(" "),
    [nowIso, nowIso, sessionId],
  );
}

async function requireSession({ db, request, environment }) {
  const cookies = parseCookies(request.headers.get("cookie"));
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) {
    return { response: redirect("/?reason=expired") };
  }

  const session = await getSession(db, token);
  if (!session) {
    return {
      response: redirect("/?reason=expired", {
        "set-cookie": clearSessionCookie(environment),
      }),
    };
  }

  const currentTime = now();
  if (session.revokedAt || !session.accountIsActive || isSessionExpired(session.expiresAt, currentTime)) {
    await revokeSession(db, session.sessionId, currentTime);
    return {
      response: redirect("/?reason=expired", {
        "set-cookie": clearSessionCookie(environment),
      }),
    };
  }

  await touchSession(db, session, currentTime);
  return { session };
}

async function sessionRoleForErrorPage({ db, request }) {
  const cookies = parseCookies(request.headers.get("cookie"));
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) {
    return null;
  }
  const session = await getSession(db, token);
  if (!session) {
    return null;
  }
  if (session.revokedAt || !session.accountIsActive || isSessionExpired(session.expiresAt, now())) {
    return null;
  }
  return session.role;
}

async function handleLogin({ db, request, environment }) {
  const form = await parseForm(request);
  const username = (form.username || "").trim();
  const password = form.password || "";
  if (!username || !password) {
    return html(loginPage({ authError: "Invalid username or password." }), 401);
  }

  const account = await findAccountForLogin(db, username);
  if (!account || account.is_active !== 1) {
    return html(loginPage({ authError: "Invalid username or password." }), 401);
  }

  const passwordOk = await verifyPassword(password, account.password_hash);
  if (!passwordOk) {
    return html(loginPage({ authError: "Invalid username or password." }), 401);
  }

  const currentTime = now();
  const token = createSessionToken();
  const tokenHash = await hashSessionToken(token);
  const csrfToken = createCsrfToken();
  const nowIso = currentTime.toISOString();
  const expiresAt = addHours(currentTime, SESSION_TTL_HOURS).toISOString();
  const userAgent = request.headers.get("user-agent") || null;
  const ipAddress =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    null;

  await db.run(
    [
      "insert into sessions",
      "(token_hash, account_id, csrf_token, expires_at, created_at, updated_at, last_seen_at, revoked_at, user_agent, ip_address)",
      "values (?, ?, ?, ?, ?, ?, ?, null, ?, ?)",
    ].join(" "),
    [tokenHash, account.id, csrfToken, expiresAt, nowIso, nowIso, nowIso, userAgent, ipAddress],
  );

  await db.run(
    "update accounts set last_login_at = ?, updated_at = ? where id = ?",
    [nowIso, nowIso, account.id],
  );

  return redirect(roleHome(account.role), {
    "set-cookie": sessionCookie(token, environment),
  });
}

function forbiddenForRole(session, message = "You are not allowed to open this page.") {
  return errorPage({
    status: 403,
    title: "Forbidden",
    message,
    role: session.role,
    includeRetry: false,
    retryHref: "",
    details: "",
    requestIdValue: requestId(),
  });
}

function csrfForbiddenForRole(session) {
  return errorPage({
    status: 403,
    title: "Forbidden",
    message: "CSRF validation failed.",
    role: session.role,
    includeRetry: false,
    retryHref: "",
    details: "",
    requestIdValue: requestId(),
  });
}

async function getResidentProfile(db, accountId) {
  return db.get(
    [
      "select r.account_id, r.apartment_id, r.full_name, r.flat_number, r.mobile_number,",
      "ap.name as apartment_name, ap.code as apartment_code",
      "from residents r",
      "join apartments ap on ap.id = r.apartment_id",
      "where r.account_id = ?",
      "limit 1",
    ].join(" "),
    [accountId],
  );
}

async function getAdminProfile(db, accountId) {
  return db.get(
    [
      "select ad.account_id, ad.apartment_id, ad.display_name, ad.mobile_number,",
      "ap.name as apartment_name, ap.code as apartment_code",
      "from admins ad",
      "join apartments ap on ap.id = ad.apartment_id",
      "where ad.account_id = ?",
      "limit 1",
    ].join(" "),
    [accountId],
  );
}

async function getStaffProfile(db, accountId) {
  return db.get(
    [
      "select st.account_id, st.full_name, st.mobile_number, st.staff_type",
      "from staff st",
      "where st.account_id = ?",
      "limit 1",
    ].join(" "),
    [accountId],
  );
}

async function listStaffLinkedApartments(db, staffAccountId) {
  return db.all(
    [
      "select ap.id, ap.name, ap.code, sal.is_active",
      "from staff_apartment_links sal",
      "join apartments ap on ap.id = sal.apartment_id",
      "where sal.staff_account_id = ? and sal.is_active = 1",
      "order by ap.name asc",
    ].join(" "),
    [staffAccountId],
  );
}

async function countResidentActiveTickets(db, residentAccountId) {
  const row = await db.get(
    [
      "select count(*) as count",
      "from tickets",
      "where resident_account_id = ? and status in ('open', 'assigned', 'in_progress')",
    ].join(" "),
    [residentAccountId],
  );
  return Number(row?.count ?? 0);
}

async function listResidentTickets(db, residentAccountId, limit = 50) {
  return db.all(
    [
      "select t.id, t.ticket_number, t.issue_type, t.title, t.status, t.updated_at,",
      "s.full_name as assigned_staff_name",
      "from tickets t",
      "left join staff s on s.account_id = t.assigned_staff_account_id",
      "where t.resident_account_id = ?",
      "order by t.id desc",
      "limit ?",
    ].join(" "),
    [residentAccountId, limit],
  );
}

async function listAdminApartmentTickets(db, apartmentId, limit = 100) {
  return db.all(
    [
      "select t.id, t.ticket_number, t.issue_type, t.title, t.status, t.updated_at,",
      "r.flat_number as resident_flat_number, r.full_name as resident_name,",
      "s.full_name as assigned_staff_name",
      "from tickets t",
      "join residents r on r.account_id = t.resident_account_id",
      "left join staff s on s.account_id = t.assigned_staff_account_id",
      "where t.apartment_id = ?",
      "order by t.id desc",
      "limit ?",
    ].join(" "),
    [apartmentId, limit],
  );
}

async function listStaffAssignedTickets(db, staffAccountId, limit = 100) {
  return db.all(
    [
      "select t.id, t.ticket_number, t.issue_type, t.title, t.status, t.updated_at,",
      "ap.name as apartment_name, r.flat_number as resident_flat_number",
      "from tickets t",
      "join apartments ap on ap.id = t.apartment_id",
      "join residents r on r.account_id = t.resident_account_id",
      "where t.assigned_staff_account_id = ? and t.status in ('assigned', 'in_progress')",
      "order by t.id desc",
      "limit ?",
    ].join(" "),
    [staffAccountId, limit],
  );
}

function ticketDetailBaseSql() {
  return [
    "select t.id, t.ticket_number, t.issue_type, t.title, t.description, t.status,",
    "t.created_at, t.updated_at, t.assigned_at, t.in_progress_at, t.completed_at,",
    "t.completed_by_admin_cancel, t.assigned_staff_account_id, t.apartment_id,",
    "ap.name as apartment_name, ap.code as apartment_code,",
    "r.account_id as resident_account_id, r.full_name as resident_name, r.flat_number as resident_flat_number, r.mobile_number as resident_mobile_number,",
    "s.full_name as assigned_staff_name, s.staff_type as assigned_staff_type, s.mobile_number as assigned_staff_mobile_number",
    "from tickets t",
    "join apartments ap on ap.id = t.apartment_id",
    "join residents r on r.account_id = t.resident_account_id",
    "left join staff s on s.account_id = t.assigned_staff_account_id",
  ];
}

async function getResidentTicketById(db, ticketId, residentAccountId) {
  return db.get(
    [
      ...ticketDetailBaseSql(),
      "where t.id = ? and t.resident_account_id = ?",
      "limit 1",
    ].join(" "),
    [ticketId, residentAccountId],
  );
}

async function getAdminTicketById(db, ticketId, apartmentId) {
  return db.get(
    [
      ...ticketDetailBaseSql(),
      "where t.id = ? and t.apartment_id = ?",
      "limit 1",
    ].join(" "),
    [ticketId, apartmentId],
  );
}

async function getStaffTicketById(db, ticketId, staffAccountId) {
  return db.get(
    [
      ...ticketDetailBaseSql(),
      "where t.id = ? and t.assigned_staff_account_id = ?",
      "limit 1",
    ].join(" "),
    [ticketId, staffAccountId],
  );
}

async function getTicketReview(db, ticketId) {
  return db.get(
    [
      "select tr.rating, tr.review_text, tr.created_at, tr.staff_account_id, st.full_name as staff_name",
      "from ticket_reviews tr",
      "join staff st on st.account_id = tr.staff_account_id",
      "where tr.ticket_id = ?",
      "limit 1",
    ].join(" "),
    [ticketId],
  );
}

async function listAssignableStaff(db, apartmentId, issueType) {
  const expectedStaffType = issueTypeToStaffType(issueType);
  return db.all(
    [
      "select st.account_id, st.full_name, st.staff_type",
      "from staff_apartment_links sal",
      "join staff st on st.account_id = sal.staff_account_id",
      "join accounts a on a.id = st.account_id",
      "where sal.apartment_id = ? and sal.is_active = 1 and a.is_active = 1 and st.staff_type = ?",
      "order by st.full_name asc",
    ].join(" "),
    [apartmentId, expectedStaffType],
  );
}

async function loadAssigneeForAssignment(db, staffAccountId) {
  return db.get(
    [
      "select st.account_id, st.full_name, st.staff_type, a.is_active",
      "from staff st",
      "join accounts a on a.id = st.account_id",
      "where st.account_id = ?",
      "limit 1",
    ].join(" "),
    [staffAccountId],
  );
}

async function hasActiveStaffApartmentLink(db, { staffAccountId, apartmentId }) {
  const row = await db.get(
    [
      "select id",
      "from staff_apartment_links",
      "where staff_account_id = ? and apartment_id = ? and is_active = 1",
      "limit 1",
    ].join(" "),
    [staffAccountId, apartmentId],
  );
  return Boolean(row);
}

async function listApartmentLinkedStaffRatings(db, apartmentId) {
  return db.all(
    [
      "select st.account_id, st.full_name, st.staff_type, st.mobile_number,",
      "count(case when tk.apartment_id = ? and tr.rating is not null then 1 end) as rating_count,",
      "avg(case when tk.apartment_id = ? then tr.rating end) as avg_rating",
      "from staff_apartment_links sal",
      "join staff st on st.account_id = sal.staff_account_id",
      "join accounts a on a.id = st.account_id",
      "left join ticket_reviews tr on tr.staff_account_id = st.account_id",
      "left join tickets tk on tk.id = tr.ticket_id",
      "where sal.apartment_id = ? and sal.is_active = 1 and a.is_active = 1",
      "group by st.account_id, st.full_name, st.staff_type, st.mobile_number",
      "order by st.full_name asc",
    ].join(" "),
    [apartmentId, apartmentId, apartmentId],
  );
}

async function listApartmentReviewTexts(db, apartmentId, limit = 50) {
  return db.all(
    [
      "select tr.ticket_id, tr.staff_account_id, st.full_name as staff_name, tr.rating, tr.review_text, tr.created_at, tk.ticket_number",
      "from ticket_reviews tr",
      "join tickets tk on tk.id = tr.ticket_id and tk.apartment_id = ?",
      "join staff st on st.account_id = tr.staff_account_id",
      "join staff_apartment_links sal on sal.staff_account_id = tr.staff_account_id and sal.apartment_id = ? and sal.is_active = 1",
      "where tr.review_text is not null and length(trim(tr.review_text)) > 0",
      "order by tr.created_at desc, tr.id desc",
      "limit ?",
    ].join(" "),
    [apartmentId, apartmentId, limit],
  );
}

async function listPlatformStaffRatings(db) {
  return db.all(
    [
      "select st.account_id, st.full_name, st.staff_type,",
      "count(case when tr.rating is not null then 1 end) as rating_count,",
      "avg(tr.rating) as avg_rating",
      "from staff st",
      "join accounts a on a.id = st.account_id",
      "left join ticket_reviews tr on tr.staff_account_id = st.account_id",
      "where a.is_active = 1",
      "group by st.account_id, st.full_name, st.staff_type",
      "order by st.full_name asc",
    ].join(" "),
  );
}

async function listTicketEvents(db, ticketId) {
  return db.all(
    [
      "select event_type, from_status, to_status, note_text, created_at",
      "from ticket_events",
      "where ticket_id = ?",
      "order by id asc",
    ].join(" "),
    [ticketId],
  );
}

async function listTicketComments(db, ticketId) {
  return db.all(
    [
      "select author_role, comment_text, created_at",
      "from ticket_comments",
      "where ticket_id = ?",
      "order by id asc",
    ].join(" "),
    [ticketId],
  );
}

function residentTicketListHtml(tickets) {
  if (tickets.length === 0) {
    return '<p class="small">No tickets yet. Use Create Ticket to open your first request.</p>';
  }
  return [
    '<ul class="ticket-list">',
    tickets
      .map((ticket) => {
        const assignedHtml = ticket.assigned_staff_name
          ? `<p class="meta-row"><strong>Assigned Staff:</strong> ${htmlEscape(ticket.assigned_staff_name)}</p>`
          : "";
        return [
          '<li class="ticket-item">',
          `<h3><a href="/tickets/${ticket.id}">${htmlEscape(ticket.ticket_number)}</a></h3>`,
          `<p class="meta-row"><strong>Title:</strong> ${htmlEscape(ticket.title)}</p>`,
          `<p class="meta-row"><strong>Issue:</strong> ${htmlEscape(issueTypeLabel(ticket.issue_type))}</p>`,
          `<p class="meta-row"><strong>Status:</strong> ${htmlEscape(statusLabel(ticket.status))}</p>`,
          assignedHtml,
          `<p class="small">Updated: ${htmlEscape(ticket.updated_at)}</p>`,
          "</li>",
        ].join("");
      })
      .join(""),
    "</ul>",
  ].join("");
}

function adminTicketListHtml(tickets) {
  if (tickets.length === 0) {
    return '<p class="small">No tickets in this apartment yet.</p>';
  }
  return [
    '<ul class="ticket-list">',
    tickets
      .map((ticket) => {
        const assignedHtml = ticket.assigned_staff_name
          ? `<p class="meta-row"><strong>Assigned Staff:</strong> ${htmlEscape(ticket.assigned_staff_name)}</p>`
          : '<p class="meta-row"><strong>Assigned Staff:</strong> Unassigned</p>';
        return [
          '<li class="ticket-item">',
          `<h3><a href="/tickets/${ticket.id}">${htmlEscape(ticket.ticket_number)}</a></h3>`,
          `<p class="meta-row"><strong>Flat:</strong> ${htmlEscape(ticket.resident_flat_number)}</p>`,
          `<p class="meta-row"><strong>Resident:</strong> ${htmlEscape(ticket.resident_name)}</p>`,
          `<p class="meta-row"><strong>Title:</strong> ${htmlEscape(ticket.title)}</p>`,
          `<p class="meta-row"><strong>Issue:</strong> ${htmlEscape(issueTypeLabel(ticket.issue_type))}</p>`,
          `<p class="meta-row"><strong>Status:</strong> ${htmlEscape(statusLabel(ticket.status))}</p>`,
          assignedHtml,
          `<p class="small">Updated: ${htmlEscape(ticket.updated_at)}</p>`,
          "</li>",
        ].join("");
      })
      .join(""),
    "</ul>",
  ].join("");
}

function staffTicketListHtml(tickets) {
  if (tickets.length === 0) {
    return '<p class="small">No assigned active tickets right now.</p>';
  }
  return [
    '<ul class="ticket-list">',
    tickets
      .map((ticket) =>
        [
          '<li class="ticket-item">',
          `<h3><a href="/tickets/${ticket.id}">${htmlEscape(ticket.ticket_number)}</a></h3>`,
          `<p class="meta-row"><strong>Apartment:</strong> ${htmlEscape(ticket.apartment_name)}</p>`,
          `<p class="meta-row"><strong>Flat:</strong> ${htmlEscape(ticket.resident_flat_number)}</p>`,
          `<p class="meta-row"><strong>Title:</strong> ${htmlEscape(ticket.title)}</p>`,
          `<p class="meta-row"><strong>Issue:</strong> ${htmlEscape(issueTypeLabel(ticket.issue_type))}</p>`,
          `<p class="meta-row"><strong>Status:</strong> ${htmlEscape(statusLabel(ticket.status))}</p>`,
          `<p class="small">Updated: ${htmlEscape(ticket.updated_at)}</p>`,
          "</li>",
        ].join(""),
      )
      .join(""),
    "</ul>",
  ].join("");
}

function createTicketPage({
  session,
  residentProfile,
  activeTicketCount,
  values = {},
  errors = {},
  formError = "",
}) {
  const issueType = values.issue_type || "";
  const title = values.title || "";
  const description = values.description || "";
  const canCreate = activeTicketCount < 5;

  const issueTypeError = errors.issue_type
    ? `<p class="field-error">${htmlEscape(errors.issue_type)}</p>`
    : "";
  const titleError = errors.title
    ? `<p class="field-error">${htmlEscape(errors.title)}</p>`
    : "";
  const descriptionError = errors.description
    ? `<p class="field-error">${htmlEscape(errors.description)}</p>`
    : "";
  const formErrorHtml = formError
    ? `<div class="message error">${htmlEscape(formError)}</div>`
    : "";
  const capHtml = canCreate
    ? ""
    : '<div class="message error">This flat already has 5 active tickets. Complete existing tickets before creating a new one.</div>';

  return doc(
    "Resident Create Ticket",
    [
      navWithLogout({
        csrfToken: session.csrfToken,
        links: [
          { href: "/resident", label: "<- Resident Home (All Tickets)" },
          { href: "/resident/account", label: "Profile" },
        ],
      }),
      "<h1>Resident Create Ticket</h1>",
      '<div class="resident-meta">',
      `<p><strong>Apartment:</strong> ${htmlEscape(residentProfile.apartment_name)}</p>`,
      `<p><strong>Flat:</strong> ${htmlEscape(residentProfile.flat_number)}</p>`,
      `<p><strong>Active Tickets:</strong> ${activeTicketCount}/5</p>`,
      "</div>",
      formErrorHtml,
      capHtml,
      '<form method="post" action="/tickets" novalidate>',
      `<input type="hidden" name="csrf_token" value="${htmlEscape(session.csrfToken)}">`,
      '<label for="issue_type">Issue Type</label>',
      '<select id="issue_type" name="issue_type" required>',
      `<option value="">Select issue type</option>`,
      `<option value="electrical"${issueType === "electrical" ? " selected" : ""}>Electrical</option>`,
      `<option value="plumbing"${issueType === "plumbing" ? " selected" : ""}>Plumbing</option>`,
      "</select>",
      issueTypeError,
      '<label for="title">Title</label>',
      `<input id="title" name="title" type="text" value="${htmlEscape(title)}" required>`,
      titleError,
      '<label for="description">Description</label>',
      `<textarea id="description" name="description" required>${htmlEscape(description)}</textarea>`,
      descriptionError,
      `<button type="submit" class="wide-button"${canCreate ? "" : " disabled"}>Create Ticket</button>`,
      "</form>",
      '<p><a href="/resident">Cancel and Return to Resident Home (All Tickets)</a></p>',
    ].join(""),
  );
}

function ticketEventSummary(event) {
  if (event.event_type === "created") {
    return "Ticket created";
  }
  if (event.event_type === "assigned") {
    return "Ticket assigned";
  }
  if (event.event_type === "reassigned") {
    return "Ticket reassigned";
  }
  if (event.event_type === "status_changed") {
    return `Status changed: ${statusLabel(event.from_status)} -> ${statusLabel(event.to_status)}`;
  }
  if (event.event_type === "admin_completed_cancel") {
    return "Ticket completed by admin (cancel/duplicate)";
  }
  return "Ticket updated";
}

function residentTicketDetailPage({
  session,
  residentProfile,
  ticket,
  events,
  comments,
  commentValues = {},
  commentErrors = {},
  commentFormError = "",
  review = null,
  reviewValues = {},
  reviewErrors = {},
  reviewFormError = "",
  responseCode = 200,
}) {
  const commentText = commentValues.comment_text || "";
  const commentErrorHtml = commentErrors.comment_text
    ? `<p class="field-error">${htmlEscape(commentErrors.comment_text)}</p>`
    : "";
  const commentFormErrorHtml = commentFormError
    ? `<div class="message error">${htmlEscape(commentFormError)}</div>`
    : "";
  const reviewRatingValue = reviewValues.rating ?? "";
  const reviewTextValue = reviewValues.review_text || "";
  const reviewRatingErrorHtml = reviewErrors.rating
    ? `<p class="field-error">${htmlEscape(reviewErrors.rating)}</p>`
    : "";
  const reviewTextErrorHtml = reviewErrors.review_text
    ? `<p class="field-error">${htmlEscape(reviewErrors.review_text)}</p>`
    : "";
  const reviewFormErrorHtml = reviewFormError
    ? `<div class="message error">${htmlEscape(reviewFormError)}</div>`
    : "";
  const assignedSection = ticket.assigned_staff_name
    ? [
      "<h2>Assigned Staff</h2>",
      '<div class="resident-meta">',
      `<p><strong>Name:</strong> ${htmlEscape(ticket.assigned_staff_name)}</p>`,
      `<p><strong>Type:</strong> ${htmlEscape(staffTypeLabel(ticket.assigned_staff_type))}</p>`,
      `<p><strong>Mobile:</strong> ${htmlEscape(ticket.assigned_staff_mobile_number)}</p>`,
      "</div>",
    ].join("")
    : '<p class="small">This ticket is not assigned yet.</p>';
  const eventsHtml = events.length
    ? [
      '<ul class="timeline">',
      events
        .map((event) =>
          [
            '<li class="timeline-item">',
            `<p class="meta-row"><strong>${htmlEscape(ticketEventSummary(event))}</strong></p>`,
            event.note_text ? `<p class="meta-row">${htmlEscape(event.note_text)}</p>` : "",
            `<p class="small">${htmlEscape(event.created_at)}</p>`,
            "</li>",
          ].join(""),
        )
        .join(""),
      "</ul>",
    ].join("")
    : '<p class="small">No timeline events yet.</p>';
  const commentsHtml = comments.length
    ? [
      '<ul class="comment-list">',
      comments
        .map((comment) =>
          [
            '<li class="comment-item">',
            `<p class="meta-row"><strong>${htmlEscape(comment.author_role)}:</strong> ${htmlEscape(comment.comment_text)}</p>`,
            `<p class="small">${htmlEscape(comment.created_at)}</p>`,
            "</li>",
          ].join(""),
        )
        .join(""),
      "</ul>",
    ].join("")
    : '<p class="small">No comments yet.</p>';
  const commentFormHtml = ticket.status === "completed"
    ? '<div class="message info">Comments are closed because this ticket is completed.</div>'
    : [
      '<form method="post" class="inline-form" action="/tickets/',
      `${ticket.id}`,
      '/comments" novalidate>',
      `<input type="hidden" name="csrf_token" value="${htmlEscape(session.csrfToken)}">`,
      '<label for="comment_text">Add Comment</label>',
      `<textarea id="comment_text" name="comment_text" required>${htmlEscape(commentText)}</textarea>`,
      commentErrorHtml,
      '<button type="submit" class="wide-button">Add Comment</button>',
      "</form>",
    ].join("");
  let reviewSectionHtml = "";
  if (ticket.status === "completed") {
    if (review) {
      reviewSectionHtml = [
        "<h2>Review</h2>",
        '<div class="resident-meta">',
        `<p><strong>Staff:</strong> ${htmlEscape(review.staff_name || ticket.assigned_staff_name || "Unknown")}</p>`,
        `<p><strong>Rating:</strong> ${htmlEscape(ratingLabel(review.rating))}</p>`,
        review.review_text ? `<p><strong>Review:</strong> ${htmlEscape(review.review_text)}</p>` : "",
        `<p class="small">Submitted: ${htmlEscape(review.created_at)}</p>`,
        "</div>",
      ].join("");
    } else if (!ticket.assigned_staff_account_id) {
      reviewSectionHtml = '<div class="message info">Review is not available because no staff was assigned.</div>';
    } else {
      const ratingOptions = ["", "1", "2", "3", "4", "5"]
        .map((value) => {
          if (value === "") {
            return `<option value=""${reviewRatingValue === "" ? " selected" : ""}>No rating</option>`;
          }
          return `<option value="${value}"${String(reviewRatingValue) === value ? " selected" : ""}>${value}</option>`;
        })
        .join("");
      reviewSectionHtml = [
        "<h2>Review</h2>",
        reviewFormErrorHtml,
        '<form method="post" class="inline-form" action="/tickets/',
        `${ticket.id}`,
        '/review" novalidate>',
        `<input type="hidden" name="csrf_token" value="${htmlEscape(session.csrfToken)}">`,
        '<label for="rating">Rating (optional)</label>',
        `<select id="rating" name="rating">${ratingOptions}</select>`,
        reviewRatingErrorHtml,
        '<label for="review_text">Review Text (optional)</label>',
        `<textarea id="review_text" name="review_text">${htmlEscape(reviewTextValue)}</textarea>`,
        reviewTextErrorHtml,
        '<button type="submit" class="wide-button">Submit Review</button>',
        "</form>",
      ].join("");
    }
  }

  return html(
    doc(
      `Ticket ${ticket.ticket_number}`,
      [
        navWithLogout({
          csrfToken: session.csrfToken,
          links: [
            { href: "/resident", label: "<- Resident Home (All Tickets)" },
            { href: "/resident/account", label: "Profile" },
          ],
        }),
        `<h1>Ticket ${htmlEscape(ticket.ticket_number)}</h1>`,
        '<div class="resident-meta">',
        `<p><strong>Apartment:</strong> ${htmlEscape(residentProfile.apartment_name)}</p>`,
        `<p><strong>Flat:</strong> ${htmlEscape(residentProfile.flat_number)}</p>`,
        `<p><strong>Issue:</strong> ${htmlEscape(issueTypeLabel(ticket.issue_type))}</p>`,
        `<p><strong>Status:</strong> ${htmlEscape(statusLabel(ticket.status))}</p>`,
        `<p><strong>Title:</strong> ${htmlEscape(ticket.title)}</p>`,
        `<p><strong>Description:</strong> ${htmlEscape(ticket.description)}</p>`,
        `<p><strong>Created:</strong> ${htmlEscape(ticket.created_at)}</p>`,
        `<p><strong>Updated:</strong> ${htmlEscape(ticket.updated_at)}</p>`,
        "</div>",
        assignedSection,
        "<h2>Timeline</h2>",
        eventsHtml,
        "<h2>Comments</h2>",
        commentFormErrorHtml,
        commentsHtml,
        commentFormHtml,
        reviewSectionHtml,
      ].join(""),
    ),
    responseCode,
  );
}

function residentPlaceholderPage({
  session,
  title,
  backLink,
  secondaryLink,
  content,
  extraHtml = "",
}) {
  return html(
    doc(
      title,
      [
        navWithLogout({
          csrfToken: session.csrfToken,
          links: [
            backLink,
            secondaryLink,
          ],
        }),
        `<h1>${htmlEscape(title)}</h1>`,
        `<div class="message info">${htmlEscape(content)}</div>`,
        extraHtml,
      ].join(""),
    ),
  );
}

function roleTicketBackLink(role) {
  if (role === "admin") {
    return { href: "/admin", label: "<- Admin Home (All Tickets)" };
  }
  if (role === "staff") {
    return { href: "/staff", label: "<- Staff Home (Assigned Tickets)" };
  }
  return { href: "/resident", label: "<- Resident Home (All Tickets)" };
}

function roleSecondaryLinks(role) {
  if (role === "admin") {
    return [
      { href: "/admin/staff", label: "Apartment Staff Performance" },
      { href: "/admin/account", label: "Profile" },
    ];
  }
  if (role === "staff") {
    return [{ href: "/staff/account", label: "Profile" }];
  }
  return [
    { href: "/resident/staff-ratings", label: "Resident Staff Ratings" },
    { href: "/resident/account", label: "Profile" },
  ];
}

function renderTimeline(events) {
  if (events.length === 0) {
    return '<p class="small">No timeline events yet.</p>';
  }
  return [
    '<ul class="timeline">',
    events
      .map((event) =>
        [
          '<li class="timeline-item">',
          `<p class="meta-row"><strong>${htmlEscape(ticketEventSummary(event))}</strong></p>`,
          event.note_text ? `<p class="meta-row">${htmlEscape(event.note_text)}</p>` : "",
          `<p class="small">${htmlEscape(event.created_at)}</p>`,
          "</li>",
        ].join(""),
      )
      .join(""),
    "</ul>",
  ].join("");
}

function renderComments(comments) {
  if (comments.length === 0) {
    return '<p class="small">No comments yet.</p>';
  }
  return [
    '<ul class="comment-list">',
    comments
      .map((comment) =>
        [
          '<li class="comment-item">',
          `<p class="meta-row"><strong>${htmlEscape(comment.author_role)}:</strong> ${htmlEscape(comment.comment_text)}</p>`,
          `<p class="small">${htmlEscape(comment.created_at)}</p>`,
          "</li>",
        ].join(""),
      )
      .join(""),
    "</ul>",
  ].join("");
}

function renderCommentForm({ session, ticketId, ticketStatus, values = {}, errors = {}, formError = "" }) {
  if (ticketStatus === "completed") {
    return '<div class="message info">Comments are closed because this ticket is completed.</div>';
  }
  const commentText = values.comment_text || "";
  const commentErrorHtml = errors.comment_text
    ? `<p class="field-error">${htmlEscape(errors.comment_text)}</p>`
    : "";
  const formErrorHtml = formError
    ? `<div class="message error">${htmlEscape(formError)}</div>`
    : "";
  return [
    formErrorHtml,
    '<form method="post" class="inline-form" action="/tickets/',
    `${ticketId}`,
    '/comments" novalidate>',
    `<input type="hidden" name="csrf_token" value="${htmlEscape(session.csrfToken)}">`,
    '<label for="comment_text">Add Comment</label>',
    `<textarea id="comment_text" name="comment_text" required>${htmlEscape(commentText)}</textarea>`,
    commentErrorHtml,
    '<button type="submit" class="wide-button">Add Comment</button>',
    "</form>",
  ].join("");
}

function renderAdminAssignForm({ session, ticket, assignableStaff, selectedStaffId = "", assignError = "" }) {
  if (ticket.status === "completed") {
    return '<div class="message info">Assignment is closed because ticket is completed.</div>';
  }
  const optionsHtml = [
    '<option value="">Select staff member</option>',
    ...assignableStaff.map((staff) => {
      const selectedAttr = String(selectedStaffId) === String(staff.account_id) ? " selected" : "";
      return `<option value="${staff.account_id}"${selectedAttr}>${htmlEscape(staff.full_name)} (${htmlEscape(staffTypeLabel(staff.staff_type))})</option>`;
    }),
  ].join("");
  const errorHtml = assignError
    ? `<div class="message error">${htmlEscape(assignError)}</div>`
    : "";
  return [
    "<h2>Assign / Reassign</h2>",
    errorHtml,
    '<form method="post" action="/tickets/',
    `${ticket.id}`,
    '/assign" novalidate>',
    `<input type="hidden" name="csrf_token" value="${htmlEscape(session.csrfToken)}">`,
    '<label for="staff_account_id">Assign Staff</label>',
    `<select id="staff_account_id" name="staff_account_id" required>${optionsHtml}</select>`,
    '<button type="submit" class="wide-button">Save Assignment</button>',
    "</form>",
  ].join("");
}

function renderAdminCompleteForm({ session, ticket, cancelReason = "", statusError = "" }) {
  if (ticket.status === "completed") {
    return '<div class="message info">Ticket is already completed.</div>';
  }
  const errorHtml = statusError
    ? `<div class="message error">${htmlEscape(statusError)}</div>`
    : "";
  return [
    "<h2>Admin Complete (Cancel / Duplicate)</h2>",
    errorHtml,
    '<form method="post" action="/tickets/',
    `${ticket.id}`,
    '/status" novalidate>',
    `<input type="hidden" name="csrf_token" value="${htmlEscape(session.csrfToken)}">`,
    '<input type="hidden" name="next_status" value="completed">',
    '<label for="cancel_reason">Cancellation Reason</label>',
    `<textarea id="cancel_reason" name="cancel_reason" required>${htmlEscape(cancelReason)}</textarea>`,
    '<button type="submit" class="wide-button">Complete Ticket as Cancelled/Duplicate</button>',
    "</form>",
  ].join("");
}

function renderStaffStatusForm({ session, ticket, nextStatus = "", statusError = "" }) {
  if (ticket.status === "completed") {
    return '<div class="message info">Ticket is already completed.</div>';
  }
  let availableOptions = [];
  if (ticket.status === "assigned") {
    availableOptions = ["in_progress"];
  } else if (ticket.status === "in_progress") {
    availableOptions = ["completed"];
  }
  if (availableOptions.length === 0) {
    return '<div class="message info">No status transition is available.</div>';
  }
  const optionsHtml = availableOptions
    .map((status) => {
      const selectedAttr = nextStatus === status ? " selected" : "";
      return `<option value="${status}"${selectedAttr}>${htmlEscape(statusLabel(status))}</option>`;
    })
    .join("");
  const errorHtml = statusError
    ? `<div class="message error">${htmlEscape(statusError)}</div>`
    : "";
  return [
    "<h2>Update Status</h2>",
    errorHtml,
    '<form method="post" action="/tickets/',
    `${ticket.id}`,
    '/status" novalidate>',
    `<input type="hidden" name="csrf_token" value="${htmlEscape(session.csrfToken)}">`,
    '<label for="next_status">Next Status</label>',
    `<select id="next_status" name="next_status">${optionsHtml}</select>`,
    '<button type="submit" class="wide-button">Update Status</button>',
    "</form>",
  ].join("");
}

function operatorTicketDetailPage({
  session,
  role,
  ticket,
  events,
  comments,
  assignableStaff = [],
  formState = {},
  responseCode = 200,
}) {
  const backLink = roleTicketBackLink(role);
  const links = [backLink, ...roleSecondaryLinks(role)];
  const assignedSection = ticket.assigned_staff_name
    ? [
      "<h2>Assigned Staff</h2>",
      '<div class="resident-meta">',
      `<p><strong>Name:</strong> ${htmlEscape(ticket.assigned_staff_name)}</p>`,
      `<p><strong>Type:</strong> ${htmlEscape(staffTypeLabel(ticket.assigned_staff_type))}</p>`,
      `<p><strong>Mobile:</strong> ${htmlEscape(ticket.assigned_staff_mobile_number)}</p>`,
      "</div>",
    ].join("")
    : '<p class="small">This ticket is currently unassigned.</p>';
  const assignmentHtml = role === "admin"
    ? renderAdminAssignForm({
      session,
      ticket,
      assignableStaff,
      selectedStaffId: formState.staff_account_id || "",
      assignError: formState.assignError || "",
    })
    : "";
  const statusHtml = role === "admin"
    ? renderAdminCompleteForm({
      session,
      ticket,
      cancelReason: formState.cancel_reason || "",
      statusError: formState.statusError || "",
    })
    : renderStaffStatusForm({
      session,
      ticket,
      nextStatus: formState.next_status || "",
      statusError: formState.statusError || "",
    });
  return html(
    doc(
      `Ticket ${ticket.ticket_number}`,
      [
        navWithLogout({ csrfToken: session.csrfToken, links }),
        `<h1>Ticket ${htmlEscape(ticket.ticket_number)}</h1>`,
        '<div class="resident-meta">',
        `<p><strong>Apartment:</strong> ${htmlEscape(ticket.apartment_name)}</p>`,
        `<p><strong>Flat:</strong> ${htmlEscape(ticket.resident_flat_number)}</p>`,
        `<p><strong>Resident:</strong> ${htmlEscape(ticket.resident_name)}</p>`,
        `<p><strong>Issue:</strong> ${htmlEscape(issueTypeLabel(ticket.issue_type))}</p>`,
        `<p><strong>Status:</strong> ${htmlEscape(statusLabel(ticket.status))}</p>`,
        `<p><strong>Title:</strong> ${htmlEscape(ticket.title)}</p>`,
        `<p><strong>Description:</strong> ${htmlEscape(ticket.description)}</p>`,
        "</div>",
        assignedSection,
        assignmentHtml,
        statusHtml,
        "<h2>Timeline</h2>",
        renderTimeline(events),
        "<h2>Comments</h2>",
        renderComments(comments),
        renderCommentForm({
          session,
          ticketId: ticket.id,
          ticketStatus: ticket.status,
          values: { comment_text: formState.comment_text || "" },
          errors: formState.commentErrors || {},
          formError: formState.commentError || "",
        }),
      ].join(""),
    ),
    responseCode,
  );
}

async function createResidentTicket({ db, residentProfile, session, input }) {
  const createdAt = now().toISOString();
  const pendingTicketNumber = `pending-${crypto.randomUUID()}`;

  await db.exec("begin");
  try {
    await db.run(
      [
        "insert into tickets",
        "(ticket_number, apartment_id, resident_account_id, resident_flat_snapshot, issue_type, title, description, status,",
        "assigned_staff_account_id, created_at, updated_at, assigned_at, in_progress_at, completed_at, completed_by_admin_cancel)",
        "values (?, ?, ?, ?, ?, ?, ?, 'open', null, ?, ?, null, null, null, 0)",
      ].join(" "),
      [
        pendingTicketNumber,
        residentProfile.apartment_id,
        session.accountId,
        residentProfile.flat_number,
        input.issue_type,
        input.title,
        input.description,
        createdAt,
        createdAt,
      ],
    );

    const row = await db.get(
      "select id from tickets where ticket_number = ? limit 1",
      [pendingTicketNumber],
    );
    const ticketId = row?.id;
    if (!ticketId) {
      throw new Error("Unable to load created ticket.");
    }

    const ticketNumber = formatTicketNumber(residentProfile.apartment_code, ticketId);
    await db.run(
      "update tickets set ticket_number = ?, updated_at = ? where id = ?",
      [ticketNumber, createdAt, ticketId],
    );
    await db.run(
      [
        "insert into ticket_events",
        "(ticket_id, event_type, from_status, to_status, from_staff_account_id, to_staff_account_id, actor_account_id, actor_role, note_text, created_at)",
        "values (?, 'created', null, 'open', null, null, ?, 'resident', null, ?)",
      ].join(" "),
      [ticketId, session.accountId, createdAt],
    );
    await db.exec("commit");
    return ticketId;
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
}

async function getTicketContextForSession({ db, session, ticketId }) {
  if (session.role === "resident") {
    const residentProfile = await getResidentProfile(db, session.accountId);
    if (!residentProfile) {
      return {
        response: forbiddenForRole(session, "Resident profile is missing."),
      };
    }
    const ticket = await getResidentTicketById(db, ticketId, session.accountId);
    if (!ticket) {
      return {
        response: null,
      };
    }
    return {
      viewerRole: "resident",
      residentProfile,
      ticket,
    };
  }

  if (session.role === "admin") {
    const adminProfile = await getAdminProfile(db, session.accountId);
    if (!adminProfile) {
      return {
        response: forbiddenForRole(session, "Admin profile is missing."),
      };
    }
    const ticket = await getAdminTicketById(db, ticketId, adminProfile.apartment_id);
    if (!ticket) {
      return {
        response: null,
      };
    }
    return {
      viewerRole: "admin",
      adminProfile,
      ticket,
    };
  }

  if (session.role === "staff") {
    const staffProfile = await getStaffProfile(db, session.accountId);
    if (!staffProfile) {
      return {
        response: forbiddenForRole(session, "Staff profile is missing."),
      };
    }
    const ticket = await getStaffTicketById(db, ticketId, session.accountId);
    if (!ticket) {
      return {
        response: null,
      };
    }
    return {
      viewerRole: "staff",
      staffProfile,
      ticket,
    };
  }

  return {
    response: forbiddenForRole(session),
  };
}

async function renderTicketDetailForContext({
  db,
  session,
  context,
  responseCode = 200,
  formState = {},
}) {
  const [events, comments] = await Promise.all([
    listTicketEvents(db, context.ticket.id),
    listTicketComments(db, context.ticket.id),
  ]);

  if (context.viewerRole === "resident") {
    const review = await getTicketReview(db, context.ticket.id);
    return residentTicketDetailPage({
      session,
      residentProfile: context.residentProfile,
      ticket: context.ticket,
      events,
      comments,
      commentValues: formState.commentValues || {},
      commentErrors: formState.commentErrors || {},
      commentFormError: formState.commentFormError || "",
      review,
      reviewValues: formState.reviewValues || {},
      reviewErrors: formState.reviewErrors || {},
      reviewFormError: formState.reviewFormError || "",
      responseCode,
    });
  }

  let assignableStaff = [];
  if (context.viewerRole === "admin") {
    assignableStaff = await listAssignableStaff(
      db,
      context.ticket.apartment_id,
      context.ticket.issue_type,
    );
  }

  return operatorTicketDetailPage({
    session,
    role: context.viewerRole,
    ticket: context.ticket,
    events,
    comments,
    assignableStaff,
    formState: {
      comment_text: formState.commentValues?.comment_text || "",
      commentErrors: formState.commentErrors || {},
      commentError: formState.commentFormError || "",
      staff_account_id: formState.staff_account_id || "",
      assignError: formState.assignError || "",
      cancel_reason: formState.cancel_reason || "",
      next_status: formState.next_status || "",
      statusError: formState.statusError || "",
    },
    responseCode,
  });
}

async function handleSharedTicketDetail({ db, request, environment, ticketId }) {
  const authResult = await requireSession({ db, request, environment });
  if (authResult.response) {
    return authResult.response;
  }
  const { session } = authResult;
  const context = await getTicketContextForSession({ db, session, ticketId });
  if (context.response) {
    return context.response;
  }
  if (!context.ticket) {
    return renderNotFound({ db, request });
  }
  return renderTicketDetailForContext({
    db,
    session,
    context,
  });
}

async function handleTicketComment({ db, request, environment, ticketId }) {
  const authResult = await requireSession({ db, request, environment });
  if (authResult.response) {
    return authResult.response;
  }
  const { session } = authResult;

  const form = await parseForm(request);
  if (!form.csrf_token || form.csrf_token !== session.csrfToken) {
    return csrfForbiddenForRole(session);
  }

  const context = await getTicketContextForSession({ db, session, ticketId });
  if (context.response) {
    return context.response;
  }
  if (!context.ticket) {
    return renderNotFound({ db, request });
  }

  const validation = validateCommentInput(form);
  if (!validation.isValid) {
    return renderTicketDetailForContext({
      db,
      session,
      context,
      responseCode: 422,
      formState: {
        commentValues: validation.values,
        commentErrors: validation.errors,
      },
    });
  }

  if (context.ticket.status === "completed") {
    return renderTicketDetailForContext({
      db,
      session,
      context,
      responseCode: 409,
      formState: {
        commentValues: validation.values,
        commentFormError: "Ticket is already completed. Comments are closed.",
      },
    });
  }

  const createdAt = now().toISOString();
  await db.exec("begin");
  try {
    await db.run(
      [
        "insert into ticket_comments",
        "(ticket_id, author_account_id, author_role, comment_text, created_at)",
        "values (?, ?, ?, ?, ?)",
      ].join(" "),
      [ticketId, session.accountId, session.role, validation.values.comment_text, createdAt],
    );
    await db.run(
      "update tickets set updated_at = ? where id = ?",
      [createdAt, ticketId],
    );
    await db.exec("commit");
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }

  return redirect(`/tickets/${ticketId}`);
}

async function handleAdminAssignTicket({ db, request, environment, ticketId }) {
  const adminAuth = await requireAdminSession({ db, request, environment });
  if (adminAuth.response) {
    return adminAuth.response;
  }
  const { session, adminProfile } = adminAuth;

  const form = await parseForm(request);
  if (!form.csrf_token || form.csrf_token !== session.csrfToken) {
    return csrfForbiddenForRole(session);
  }

  const ticket = await getAdminTicketById(db, ticketId, adminProfile.apartment_id);
  if (!ticket) {
    return renderNotFound({ db, request });
  }

  const context = {
    viewerRole: "admin",
    adminProfile,
    ticket,
  };

  if (ticket.status === "completed") {
    return renderTicketDetailForContext({
      db,
      session,
      context,
      responseCode: 409,
      formState: {
        assignError: "Completed tickets cannot be assigned.",
      },
    });
  }

  const staffAccountId = parsePositiveInt(form.staff_account_id);
  if (!staffAccountId) {
    return renderTicketDetailForContext({
      db,
      session,
      context,
      responseCode: 422,
      formState: {
        staff_account_id: form.staff_account_id || "",
        assignError: "Please select a valid staff member.",
      },
    });
  }

  const assignee = await loadAssigneeForAssignment(db, staffAccountId);
  if (!assignee || assignee.is_active !== 1) {
    return renderTicketDetailForContext({
      db,
      session,
      context,
      responseCode: 422,
      formState: {
        staff_account_id: String(staffAccountId),
        assignError: "Selected staff account is invalid.",
      },
    });
  }

  const hasActiveLink = await hasActiveStaffApartmentLink(db, {
    staffAccountId,
    apartmentId: adminProfile.apartment_id,
  });
  if (!hasActiveLink) {
    return renderTicketDetailForContext({
      db,
      session,
      context,
      responseCode: 422,
      formState: {
        staff_account_id: String(staffAccountId),
        assignError: "Staff is not actively linked to this apartment.",
      },
    });
  }

  const requiredStaffType = issueTypeToStaffType(ticket.issue_type);
  if (assignee.staff_type !== requiredStaffType) {
    return renderTicketDetailForContext({
      db,
      session,
      context,
      responseCode: 422,
      formState: {
        staff_account_id: String(staffAccountId),
        assignError: "Staff type does not match ticket issue type.",
      },
    });
  }

  const nowIso = now().toISOString();
  const fromStaffAccountId = ticket.assigned_staff_account_id;
  const isReassignment = fromStaffAccountId && fromStaffAccountId !== staffAccountId;
  const isSameAssignment = fromStaffAccountId === staffAccountId;
  const nextStatus = ticket.status === "open" ? "assigned" : ticket.status;

  if (isSameAssignment && ticket.status !== "open") {
    return redirect(`/tickets/${ticketId}`);
  }

  await db.exec("begin");
  try {
    await db.run(
      [
        "update tickets",
        "set assigned_staff_account_id = ?, status = ?, updated_at = ?, assigned_at = coalesce(assigned_at, ?)",
        "where id = ?",
      ].join(" "),
      [staffAccountId, nextStatus, nowIso, nowIso, ticketId],
    );

    const eventType = isReassignment ? "reassigned" : "assigned";
    await db.run(
      [
        "insert into ticket_events",
        "(ticket_id, event_type, from_status, to_status, from_staff_account_id, to_staff_account_id, actor_account_id, actor_role, note_text, created_at)",
        "values (?, ?, ?, ?, ?, ?, ?, 'admin', null, ?)",
      ].join(" "),
      [
        ticketId,
        eventType,
        ticket.status,
        nextStatus,
        fromStaffAccountId,
        staffAccountId,
        session.accountId,
        nowIso,
      ],
    );

    await db.exec("commit");
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }

  return redirect(`/tickets/${ticketId}`);
}

async function handleTicketStatusUpdate({ db, request, environment, ticketId }) {
  const authResult = await requireSession({ db, request, environment });
  if (authResult.response) {
    return authResult.response;
  }
  const { session } = authResult;

  const form = await parseForm(request);
  if (!form.csrf_token || form.csrf_token !== session.csrfToken) {
    return csrfForbiddenForRole(session);
  }

  const context = await getTicketContextForSession({ db, session, ticketId });
  if (context.response) {
    return context.response;
  }
  if (!context.ticket) {
    return renderNotFound({ db, request });
  }

  const nextStatus = (form.next_status || "").trim().toLowerCase();
  const ticket = context.ticket;
  const nowIso = now().toISOString();

  if (session.role === "staff") {
    const isAssignedToInProgress = ticket.status === "assigned" && nextStatus === "in_progress";
    const isInProgressToCompleted = ticket.status === "in_progress" && nextStatus === "completed";
    if (!isAssignedToInProgress && !isInProgressToCompleted) {
      return renderTicketDetailForContext({
        db,
        session,
        context,
        responseCode: 409,
        formState: {
          next_status: nextStatus,
          statusError: "Invalid staff status transition.",
        },
      });
    }

    await db.exec("begin");
    try {
      await db.run(
        [
          "update tickets",
          "set status = ?, updated_at = ?,",
          "in_progress_at = case when ? = 'in_progress' then coalesce(in_progress_at, ?) else in_progress_at end,",
          "completed_at = case when ? = 'completed' then coalesce(completed_at, ?) else completed_at end",
          "where id = ?",
        ].join(" "),
        [nextStatus, nowIso, nextStatus, nowIso, nextStatus, nowIso, ticketId],
      );
      await db.run(
        [
          "insert into ticket_events",
          "(ticket_id, event_type, from_status, to_status, from_staff_account_id, to_staff_account_id, actor_account_id, actor_role, note_text, created_at)",
          "values (?, 'status_changed', ?, ?, ?, ?, ?, 'staff', null, ?)",
        ].join(" "),
        [
          ticketId,
          ticket.status,
          nextStatus,
          ticket.assigned_staff_account_id,
          ticket.assigned_staff_account_id,
          session.accountId,
          nowIso,
        ],
      );
      await db.exec("commit");
    } catch (error) {
      await db.exec("rollback");
      throw error;
    }
    return redirect(`/tickets/${ticketId}`);
  }

  if (session.role === "admin") {
    if (nextStatus !== "completed") {
      return renderTicketDetailForContext({
        db,
        session,
        context,
        responseCode: 409,
        formState: {
          cancel_reason: form.cancel_reason || "",
          statusError: "Admin can only complete tickets through this action.",
        },
      });
    }
    if (ticket.status === "completed") {
      return renderTicketDetailForContext({
        db,
        session,
        context,
        responseCode: 409,
        formState: {
          cancel_reason: form.cancel_reason || "",
          statusError: "Ticket is already completed.",
        },
      });
    }
    const cancelReason = (form.cancel_reason || "").trim();
    if (!cancelReason) {
      return renderTicketDetailForContext({
        db,
        session,
        context,
        responseCode: 422,
        formState: {
          cancel_reason: form.cancel_reason || "",
          statusError: "Cancellation reason is required.",
        },
      });
    }

    await db.exec("begin");
    try {
      await db.run(
        [
          "update tickets",
          "set status = 'completed', updated_at = ?, completed_at = coalesce(completed_at, ?), completed_by_admin_cancel = 1",
          "where id = ?",
        ].join(" "),
        [nowIso, nowIso, ticketId],
      );
      await db.run(
        [
          "insert into ticket_events",
          "(ticket_id, event_type, from_status, to_status, from_staff_account_id, to_staff_account_id, actor_account_id, actor_role, note_text, created_at)",
          "values (?, 'admin_completed_cancel', ?, 'completed', ?, ?, ?, 'admin', ?, ?)",
        ].join(" "),
        [
          ticketId,
          ticket.status,
          ticket.assigned_staff_account_id,
          ticket.assigned_staff_account_id,
          session.accountId,
          cancelReason,
          nowIso,
        ],
      );
      await db.run(
        [
          "insert into ticket_comments",
          "(ticket_id, author_account_id, author_role, comment_text, created_at)",
          "values (?, ?, 'admin', ?, ?)",
        ].join(" "),
        [ticketId, session.accountId, cancelReason, nowIso],
      );
      await db.exec("commit");
    } catch (error) {
      await db.exec("rollback");
      throw error;
    }

    return redirect(`/tickets/${ticketId}`);
  }

  return forbiddenForRole(session);
}

async function handleResidentReviewSubmit({ db, request, environment, ticketId }) {
  const residentAuth = await requireResidentSession({ db, request, environment });
  if (residentAuth.response) {
    return residentAuth.response;
  }
  const { session, residentProfile } = residentAuth;

  const form = await parseForm(request);
  if (!form.csrf_token || form.csrf_token !== session.csrfToken) {
    return csrfForbiddenForRole(session);
  }

  const ticket = await getResidentTicketById(db, ticketId, session.accountId);
  if (!ticket) {
    return renderNotFound({ db, request });
  }

  const context = {
    viewerRole: "resident",
    residentProfile,
    ticket,
  };

  const validation = validateReviewInput(form);
  if (!validation.isValid) {
    return renderTicketDetailForContext({
      db,
      session,
      context,
      responseCode: 422,
      formState: {
        reviewValues: validation.values,
        reviewErrors: validation.errors,
      },
    });
  }

  if (ticket.status !== "completed") {
    return renderTicketDetailForContext({
      db,
      session,
      context,
      responseCode: 409,
      formState: {
        reviewValues: validation.values,
        reviewFormError: "Review is allowed only after completion.",
      },
    });
  }

  if (!ticket.assigned_staff_account_id) {
    return renderTicketDetailForContext({
      db,
      session,
      context,
      responseCode: 409,
      formState: {
        reviewValues: validation.values,
        reviewFormError: "Review is not available because no staff was assigned.",
      },
    });
  }

  const existingReview = await getTicketReview(db, ticketId);
  if (existingReview) {
    return renderTicketDetailForContext({
      db,
      session,
      context,
      responseCode: 409,
      formState: {
        reviewValues: validation.values,
        reviewFormError: "A review already exists for this ticket.",
      },
    });
  }

  const createdAt = now().toISOString();
  const reviewText = validation.values.review_text || null;
  await db.run(
    [
      "insert into ticket_reviews",
      "(ticket_id, resident_account_id, staff_account_id, rating, review_text, created_at)",
      "values (?, ?, ?, ?, ?, ?)",
    ].join(" "),
    [
      ticketId,
      session.accountId,
      ticket.assigned_staff_account_id,
      validation.values.rating,
      reviewText,
      createdAt,
    ],
  );

  return redirect(`/tickets/${ticketId}`);
}

async function handleRoleHome({ db, request, requiredRole, environment }) {
  const authResult = await requireSession({ db, request, environment });
  if (authResult.response) {
    return authResult.response;
  }
  const { session } = authResult;
  if (session.role !== requiredRole) {
    return forbiddenForRole(session);
  }

  if (requiredRole === "resident") {
    const residentProfile = await getResidentProfile(db, session.accountId);
    if (!residentProfile) {
      return forbiddenForRole(session, "Resident profile is missing.");
    }
    const activeTicketCount = await countResidentActiveTickets(db, session.accountId);
    const tickets = await listResidentTickets(db, session.accountId);
    return html(
      pageWithLogout({
        title: "Resident Home (All Tickets)",
        welcomeText: `Logged in as ${session.username}.`,
        csrfToken: session.csrfToken,
        detailsHtml: [
          '<div class="resident-meta">',
          `<p><strong>Apartment:</strong> ${htmlEscape(residentProfile.apartment_name)}</p>`,
          `<p><strong>Flat:</strong> ${htmlEscape(residentProfile.flat_number)}</p>`,
          `<p><strong>Resident:</strong> ${htmlEscape(residentProfile.full_name)}</p>`,
          `<p><strong>Mobile:</strong> ${htmlEscape(residentProfile.mobile_number)}</p>`,
          `<p><strong>Active Tickets:</strong> ${activeTicketCount}/5</p>`,
          "</div>",
          "<h2>All Tickets</h2>",
          residentTicketListHtml(tickets),
        ].join(""),
        primaryAction: activeTicketCount < 5
          ? {
            method: "get",
            href: "/tickets/new",
            label: "Create Ticket",
          }
          : null,
        links: [
          { href: "/resident/staff-ratings", label: "Resident Staff Ratings" },
          { href: "/resident/account", label: "Profile" },
        ],
      }),
    );
  }
  if (requiredRole === "admin") {
    const adminProfile = await getAdminProfile(db, session.accountId);
    if (!adminProfile) {
      return forbiddenForRole(session, "Admin profile is missing.");
    }
    const tickets = await listAdminApartmentTickets(db, adminProfile.apartment_id);
    const kpi = {
      open: tickets.filter((ticket) => ticket.status === "open").length,
      assigned: tickets.filter((ticket) => ticket.status === "assigned").length,
      inProgress: tickets.filter((ticket) => ticket.status === "in_progress").length,
      completed: tickets.filter((ticket) => ticket.status === "completed").length,
    };
    return html(
      pageWithLogout({
        title: "Admin Home (All Tickets)",
        welcomeText: `Logged in as ${session.username}.`,
        csrfToken: session.csrfToken,
        detailsHtml: [
          '<div class="resident-meta">',
          `<p><strong>Apartment:</strong> ${htmlEscape(adminProfile.apartment_name)}</p>`,
          "<p><strong>Flat:</strong> N/A (Admin account)</p>",
          `<p><strong>Open:</strong> ${kpi.open}</p>`,
          `<p><strong>Assigned:</strong> ${kpi.assigned}</p>`,
          `<p><strong>In Progress:</strong> ${kpi.inProgress}</p>`,
          `<p><strong>Completed:</strong> ${kpi.completed}</p>`,
          "</div>",
          "<h2>Apartment Ticket Queue</h2>",
          adminTicketListHtml(tickets),
        ].join(""),
        links: [
          { href: "/admin/staff", label: "Apartment Staff Performance" },
          { href: "/admin/account", label: "Profile" },
        ],
      }),
    );
  }

  const staffProfile = await getStaffProfile(db, session.accountId);
  if (!staffProfile) {
    return forbiddenForRole(session, "Staff profile is missing.");
  }
  const linkedApartments = await listStaffLinkedApartments(db, session.accountId);
  const tickets = await listStaffAssignedTickets(db, session.accountId);
  const linkedNames = linkedApartments.map((row) => row.name).join(", ") || "No active apartment links";
  return html(
    pageWithLogout({
      title: "Staff Home (Assigned Tickets)",
      welcomeText: `Logged in as ${session.username}.`,
      csrfToken: session.csrfToken,
      links: [{ href: "/staff/account", label: "Profile" }],
      detailsHtml: [
        '<div class="resident-meta">',
        `<p><strong>Name:</strong> ${htmlEscape(staffProfile.full_name)}</p>`,
        `<p><strong>Type:</strong> ${htmlEscape(staffTypeLabel(staffProfile.staff_type))}</p>`,
        `<p><strong>Mobile:</strong> ${htmlEscape(staffProfile.mobile_number)}</p>`,
        `<p><strong>Linked Apartments:</strong> ${htmlEscape(linkedNames)}</p>`,
        "</div>",
        "<h2>Assigned Tickets</h2>",
        staffTicketListHtml(tickets),
      ].join(""),
    }),
  );
}

async function requireResidentSession({ db, request, environment }) {
  const authResult = await requireSession({ db, request, environment });
  if (authResult.response) {
    return authResult;
  }

  const { session } = authResult;
  if (session.role !== "resident") {
    return {
      response: forbiddenForRole(session),
    };
  }

  const residentProfile = await getResidentProfile(db, session.accountId);
  if (!residentProfile) {
    return {
      response: forbiddenForRole(session, "Resident profile is missing."),
    };
  }

  return {
    session,
    residentProfile,
  };
}

async function requireAdminSession({ db, request, environment }) {
  const authResult = await requireSession({ db, request, environment });
  if (authResult.response) {
    return authResult;
  }

  const { session } = authResult;
  if (session.role !== "admin") {
    return {
      response: forbiddenForRole(session),
    };
  }

  const adminProfile = await getAdminProfile(db, session.accountId);
  if (!adminProfile) {
    return {
      response: forbiddenForRole(session, "Admin profile is missing."),
    };
  }

  return {
    session,
    adminProfile,
  };
}

async function requireStaffSession({ db, request, environment }) {
  const authResult = await requireSession({ db, request, environment });
  if (authResult.response) {
    return authResult;
  }

  const { session } = authResult;
  if (session.role !== "staff") {
    return {
      response: forbiddenForRole(session),
    };
  }

  const staffProfile = await getStaffProfile(db, session.accountId);
  if (!staffProfile) {
    return {
      response: forbiddenForRole(session, "Staff profile is missing."),
    };
  }

  return {
    session,
    staffProfile,
  };
}

async function handleResidentCreateTicketPage({ db, request, environment }) {
  const residentAuth = await requireResidentSession({ db, request, environment });
  if (residentAuth.response) {
    return residentAuth.response;
  }
  const { session, residentProfile } = residentAuth;
  const activeTicketCount = await countResidentActiveTickets(db, session.accountId);
  return html(
    createTicketPage({
      session,
      residentProfile,
      activeTicketCount,
    }),
  );
}

async function handleResidentCreateTicket({ db, request, environment }) {
  const residentAuth = await requireResidentSession({ db, request, environment });
  if (residentAuth.response) {
    return residentAuth.response;
  }

  const { session, residentProfile } = residentAuth;
  const form = await parseForm(request);
  if (!form.csrf_token || form.csrf_token !== session.csrfToken) {
    return csrfForbiddenForRole(session);
  }

  const validation = validateTicketCreateInput(form);
  const activeTicketCount = await countResidentActiveTickets(db, session.accountId);
  if (!validation.isValid) {
    return html(
      createTicketPage({
        session,
        residentProfile,
        activeTicketCount,
        values: validation.values,
        errors: validation.errors,
      }),
      422,
    );
  }
  if (activeTicketCount >= 5) {
    return html(
      createTicketPage({
        session,
        residentProfile,
        activeTicketCount,
        values: validation.values,
        formError: "Active ticket limit reached for this flat.",
      }),
      409,
    );
  }

  const ticketId = await createResidentTicket({
    db,
    residentProfile,
    session,
    input: validation.values,
  });

  return redirect(`/tickets/${ticketId}`);
}

async function handleResidentTicketDetail({ db, request, environment, ticketId }) {
  const authResult = await requireSession({ db, request, environment });
  if (authResult.response) {
    return authResult.response;
  }
  const { session } = authResult;
  if (session.role !== "resident") {
    return renderNotFound({ db, request });
  }

  const residentProfile = await getResidentProfile(db, session.accountId);
  if (!residentProfile) {
    return forbiddenForRole(session, "Resident profile is missing.");
  }

  const ticket = await getResidentTicketById(db, ticketId, session.accountId);
  if (!ticket) {
    return renderNotFound({ db, request });
  }

  const [events, comments] = await Promise.all([
    listTicketEvents(db, ticketId),
    listTicketComments(db, ticketId),
  ]);
  return residentTicketDetailPage({
    session,
    residentProfile,
    ticket,
    events,
    comments,
  });
}

async function handleResidentTicketComment({ db, request, environment, ticketId }) {
  const authResult = await requireSession({ db, request, environment });
  if (authResult.response) {
    return authResult.response;
  }
  const { session } = authResult;
  if (session.role !== "resident") {
    return renderNotFound({ db, request });
  }

  const residentProfile = await getResidentProfile(db, session.accountId);
  if (!residentProfile) {
    return forbiddenForRole(session, "Resident profile is missing.");
  }

  const form = await parseForm(request);
  if (!form.csrf_token || form.csrf_token !== session.csrfToken) {
    return csrfForbiddenForRole(session);
  }

  const ticket = await getResidentTicketById(db, ticketId, session.accountId);
  if (!ticket) {
    return renderNotFound({ db, request });
  }

  const validation = validateCommentInput(form);
  const [events, comments] = await Promise.all([
    listTicketEvents(db, ticketId),
    listTicketComments(db, ticketId),
  ]);

  if (!validation.isValid) {
    return residentTicketDetailPage({
      session,
      residentProfile,
      ticket,
      events,
      comments,
      commentValues: validation.values,
      commentErrors: validation.errors,
      responseCode: 422,
    });
  }

  if (ticket.status === "completed") {
    return residentTicketDetailPage({
      session,
      residentProfile,
      ticket,
      events,
      comments,
      commentValues: validation.values,
      formError: "Ticket is already completed. Comments are closed.",
      responseCode: 409,
    });
  }

  const createdAt = now().toISOString();
  await db.exec("begin");
  try {
    await db.run(
      [
        "insert into ticket_comments",
        "(ticket_id, author_account_id, author_role, comment_text, created_at)",
        "values (?, ?, 'resident', ?, ?)",
      ].join(" "),
      [ticketId, session.accountId, validation.values.comment_text, createdAt],
    );
    await db.run(
      "update tickets set updated_at = ? where id = ?",
      [createdAt, ticketId],
    );
    await db.exec("commit");
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }

  return redirect(`/tickets/${ticketId}`);
}

async function handleResidentAccountPage({ db, request, environment }) {
  const residentAuth = await requireResidentSession({ db, request, environment });
  if (residentAuth.response) {
    return residentAuth.response;
  }
  const { session, residentProfile } = residentAuth;
  return residentPlaceholderPage({
    session,
    title: "Resident Account",
    backLink: { href: "/resident", label: "<- Resident Home (All Tickets)" },
    secondaryLink: { href: "/resident/staff-ratings", label: "Resident Staff Ratings" },
    content: "Resident account management is planned for a later milestone.",
    extraHtml: [
      '<div class="resident-meta">',
      `<p><strong>Name:</strong> ${htmlEscape(residentProfile.full_name)}</p>`,
      `<p><strong>Apartment:</strong> ${htmlEscape(residentProfile.apartment_name)}</p>`,
      `<p><strong>Flat:</strong> ${htmlEscape(residentProfile.flat_number)}</p>`,
      `<p><strong>Mobile:</strong> ${htmlEscape(residentProfile.mobile_number)}</p>`,
      "</div>",
    ].join(""),
  });
}

async function handleResidentStaffRatingsPage({ db, request, environment }) {
  const residentAuth = await requireResidentSession({ db, request, environment });
  if (residentAuth.response) {
    return residentAuth.response;
  }
  const { session, residentProfile } = residentAuth;
  const [ratings, reviews] = await Promise.all([
    listApartmentLinkedStaffRatings(db, residentProfile.apartment_id),
    listApartmentReviewTexts(db, residentProfile.apartment_id),
  ]);
  const summaryRows = ratings.length
    ? [
      '<ul class="ticket-list">',
      ratings
        .map((row) =>
          [
            '<li class="ticket-item">',
            `<h3>${htmlEscape(row.full_name)}</h3>`,
            `<p class="meta-row"><strong>Type:</strong> ${htmlEscape(staffTypeLabel(row.staff_type))}</p>`,
            `<p class="meta-row"><strong>Ratings:</strong> ${htmlEscape(String(row.rating_count || 0))}</p>`,
            `<p class="meta-row"><strong>Average Rating:</strong> ${htmlEscape(formatAverageRating(row.avg_rating))}</p>`,
            "</li>",
          ].join(""),
        )
        .join(""),
      "</ul>",
    ].join("")
    : '<p class="small">No active linked staff found for this apartment.</p>';
  const reviewRows = reviews.length
    ? [
      "<h2>Recent Reviews</h2>",
      '<ul class="comment-list">',
      reviews
        .map((review) =>
          [
            '<li class="comment-item">',
            `<p class="meta-row"><strong>${htmlEscape(review.staff_name)} (${htmlEscape(ratingLabel(review.rating))})</strong></p>`,
            `<p class="meta-row">${htmlEscape(review.review_text)}</p>`,
            `<p class="small">${htmlEscape(review.ticket_number)} • ${htmlEscape(review.created_at)}</p>`,
            "</li>",
          ].join(""),
        )
        .join(""),
      "</ul>",
    ].join("")
    : '<p class="small">No text reviews yet.</p>';

  return html(
    doc(
      "Resident Staff Ratings",
      [
        navWithLogout({
          csrfToken: session.csrfToken,
          links: [
            { href: "/resident", label: "<- Resident Home (All Tickets)" },
            { href: "/resident/account", label: "Profile" },
          ],
        }),
        "<h1>Resident Staff Ratings</h1>",
        "<h2>Linked Staff Summary</h2>",
        summaryRows,
        reviewRows,
      ].join(""),
    ),
  );
}

async function handleAdminAccountPage({ db, request, environment }) {
  const adminAuth = await requireAdminSession({ db, request, environment });
  if (adminAuth.response) {
    return adminAuth.response;
  }
  const { session, adminProfile } = adminAuth;
  return html(
    doc(
      "Admin Account",
      [
        navWithLogout({
          csrfToken: session.csrfToken,
          links: [
            { href: "/admin", label: "<- Admin Home (All Tickets)" },
            { href: "/admin/staff", label: "Apartment Staff Performance" },
          ],
        }),
        "<h1>Admin Account</h1>",
        '<div class="resident-meta">',
        `<p><strong>Display Name:</strong> ${htmlEscape(adminProfile.display_name)}</p>`,
        `<p><strong>Apartment:</strong> ${htmlEscape(adminProfile.apartment_name)}</p>`,
        `<p><strong>Mobile:</strong> ${htmlEscape(adminProfile.mobile_number || "N/A")}</p>`,
        "</div>",
      ].join(""),
    ),
  );
}

async function handleStaffAccountPage({ db, request, environment }) {
  const staffAuth = await requireStaffSession({ db, request, environment });
  if (staffAuth.response) {
    return staffAuth.response;
  }
  const { session, staffProfile } = staffAuth;
  const linkedApartments = await listStaffLinkedApartments(db, session.accountId);
  const apartmentsHtml = linkedApartments.length
    ? [
      "<h2>Linked Apartments</h2>",
      "<ul>",
      linkedApartments.map((row) => `<li>${htmlEscape(row.name)}</li>`).join(""),
      "</ul>",
    ].join("")
    : '<p class="small">No active apartment links.</p>';
  return html(
    doc(
      "Staff Account",
      [
        navWithLogout({
          csrfToken: session.csrfToken,
          links: [
            { href: "/staff", label: "<- Staff Home (Assigned Tickets)" },
          ],
        }),
        "<h1>Staff Account</h1>",
        '<div class="resident-meta">',
        `<p><strong>Name:</strong> ${htmlEscape(staffProfile.full_name)}</p>`,
        `<p><strong>Type:</strong> ${htmlEscape(staffTypeLabel(staffProfile.staff_type))}</p>`,
        `<p><strong>Mobile:</strong> ${htmlEscape(staffProfile.mobile_number)}</p>`,
        "</div>",
        apartmentsHtml,
      ].join(""),
    ),
  );
}

async function handleAdminStaffRatingsPage({ db, request, environment }) {
  const adminAuth = await requireAdminSession({ db, request, environment });
  if (adminAuth.response) {
    return adminAuth.response;
  }
  const { session, adminProfile } = adminAuth;
  const url = new URL(request.url);
  const view = url.searchParams.get("view") === "platform" ? "platform" : "apartment";

  if (view === "platform") {
    const rows = await listPlatformStaffRatings(db);
    const rowsHtml = rows.length
      ? [
        '<ul class="ticket-list">',
        rows
          .map((row) =>
            [
              '<li class="ticket-item">',
              `<h3>${htmlEscape(row.full_name)}</h3>`,
              `<p class="meta-row"><strong>Type:</strong> ${htmlEscape(staffTypeLabel(row.staff_type))}</p>`,
              `<p class="meta-row"><strong>Ratings:</strong> ${htmlEscape(String(row.rating_count || 0))}</p>`,
              `<p class="meta-row"><strong>Average Rating:</strong> ${htmlEscape(formatAverageRating(row.avg_rating))}</p>`,
              "</li>",
            ].join(""),
          )
          .join(""),
        "</ul>",
      ].join("")
      : '<p class="small">No staff records found.</p>';
    return html(
      doc(
        "Apartment Staff Performance",
        [
          navWithLogout({
            csrfToken: session.csrfToken,
            links: [
              { href: "/admin", label: "<- Admin Home (All Tickets)" },
              { href: "/admin/staff", label: "Apartment Scope View" },
              { href: "/admin/account", label: "Profile" },
            ],
          }),
          "<h1>Apartment Staff Performance</h1>",
          '<div class="message info">Viewing platform-wide rating summary (counts and averages only).</div>',
          rowsHtml,
        ].join(""),
      ),
    );
  }

  const [ratings, reviews] = await Promise.all([
    listApartmentLinkedStaffRatings(db, adminProfile.apartment_id),
    listApartmentReviewTexts(db, adminProfile.apartment_id),
  ]);
  const summaryRows = ratings.length
    ? [
      '<ul class="ticket-list">',
      ratings
        .map((row) =>
          [
            '<li class="ticket-item">',
            `<h3>${htmlEscape(row.full_name)}</h3>`,
            `<p class="meta-row"><strong>Type:</strong> ${htmlEscape(staffTypeLabel(row.staff_type))}</p>`,
            `<p class="meta-row"><strong>Ratings:</strong> ${htmlEscape(String(row.rating_count || 0))}</p>`,
            `<p class="meta-row"><strong>Average Rating:</strong> ${htmlEscape(formatAverageRating(row.avg_rating))}</p>`,
            "</li>",
          ].join(""),
        )
        .join(""),
      "</ul>",
    ].join("")
    : '<p class="small">No active linked staff found for this apartment.</p>';
  const reviewRows = reviews.length
    ? [
      "<h2>Recent Reviews</h2>",
      '<ul class="comment-list">',
      reviews
        .map((review) =>
          [
            '<li class="comment-item">',
            `<p class="meta-row"><strong>${htmlEscape(review.staff_name)} (${htmlEscape(ratingLabel(review.rating))})</strong></p>`,
            `<p class="meta-row">${htmlEscape(review.review_text)}</p>`,
            `<p class="small">${htmlEscape(review.ticket_number)} • ${htmlEscape(review.created_at)}</p>`,
            "</li>",
          ].join(""),
        )
        .join(""),
      "</ul>",
    ].join("")
    : '<p class="small">No text reviews yet.</p>';

  return html(
    doc(
      "Apartment Staff Performance",
      [
        navWithLogout({
          csrfToken: session.csrfToken,
          links: [
            { href: "/admin", label: "<- Admin Home (All Tickets)" },
            { href: "/admin/staff?view=platform", label: "Platform Scope View" },
            { href: "/admin/account", label: "Profile" },
          ],
        }),
        "<h1>Apartment Staff Performance</h1>",
        '<div class="resident-meta">',
        `<p><strong>Apartment:</strong> ${htmlEscape(adminProfile.apartment_name)}</p>`,
        "</div>",
        "<h2>Linked Staff Summary</h2>",
        summaryRows,
        reviewRows,
      ].join(""),
    ),
  );
}

async function handleLogout({ db, request, environment }) {
  const authResult = await requireSession({ db, request, environment });
  if (authResult.response) {
    return authResult.response;
  }
  const { session } = authResult;
  const form = await parseForm(request);
  if (!form.csrf_token || form.csrf_token !== session.csrfToken) {
    return errorPage({
      status: 403,
      title: "Forbidden",
      message: "CSRF validation failed.",
      role: session.role,
      includeRetry: false,
      retryHref: "",
      details: "",
      requestIdValue: requestId(),
    });
  }
  await revokeSession(db, session.sessionId, now());
  return redirect("/?reason=logged_out", {
    "set-cookie": clearSessionCookie(environment),
  });
}

async function renderForbidden({ db, request }) {
  const role = await sessionRoleForErrorPage({ db, request });
  return errorPage({
    status: 403,
    title: "Forbidden",
    message: "You are not allowed to do that.",
    role,
    includeRetry: false,
    retryHref: "",
    details: "",
    requestIdValue: requestId(),
  });
}

async function renderNotFound({ db, request }) {
  const role = await sessionRoleForErrorPage({ db, request });
  return errorPage({
    status: 404,
    title: "Not Found",
    message: "The page you requested was not found.",
    role,
    includeRetry: false,
    retryHref: "",
    details: "",
    requestIdValue: requestId(),
  });
}

function renderServerError({ request, error }) {
  const details = error instanceof Error ? `${error.message}\n\n${error.stack || ""}` : String(error);
  return errorPage({
    status: 500,
    title: "Error",
    message: "An unexpected server error occurred.",
    role: null,
    includeRetry: true,
    retryHref: new URL(request.url).pathname || "/",
    details,
    requestIdValue: requestId(),
  });
}

export function createApp({ db, environment = "local" }) {
  return {
    async fetch(request) {
      try {
        const url = new URL(request.url);
        const ticketDetailId = parseTicketId(url.pathname, /^\/tickets\/(\d+)$/);
        const ticketCommentId = parseTicketId(url.pathname, /^\/tickets\/(\d+)\/comments$/);
        const ticketAssignId = parseTicketId(url.pathname, /^\/tickets\/(\d+)\/assign$/);
        const ticketStatusId = parseTicketId(url.pathname, /^\/tickets\/(\d+)\/status$/);
        const ticketReviewId = parseTicketId(url.pathname, /^\/tickets\/(\d+)\/review$/);

        if (url.pathname === "/_health/") {
          return text("ok");
        }

        if (url.pathname === "/_db/") {
          try {
            const row = await db.get("select value from meta where key = 'schema_version'");
            return text(`db ok (schema_version=${row?.value ?? "unknown"})`);
          } catch (error) {
            return text(`db error: ${String(error)}`, 500);
          }
        }

        if (request.method === "GET" && url.pathname === "/") {
          return html(loginPage({ reason: url.searchParams.get("reason") || "" }));
        }

        if (request.method === "POST" && url.pathname === "/login") {
          return handleLogin({ db, request, environment });
        }

        if (request.method === "POST" && url.pathname === "/logout") {
          return handleLogout({ db, request, environment });
        }

        if (request.method === "GET" && url.pathname === "/resident") {
          return handleRoleHome({ db, request, requiredRole: "resident", environment });
        }

        if (request.method === "GET" && url.pathname === "/tickets/new") {
          return handleResidentCreateTicketPage({ db, request, environment });
        }

        if (request.method === "POST" && url.pathname === "/tickets") {
          return handleResidentCreateTicket({ db, request, environment });
        }

        if (request.method === "GET" && ticketDetailId) {
          return handleSharedTicketDetail({
            db,
            request,
            environment,
            ticketId: ticketDetailId,
          });
        }

        if (request.method === "POST" && ticketCommentId) {
          return handleTicketComment({
            db,
            request,
            environment,
            ticketId: ticketCommentId,
          });
        }

        if (request.method === "POST" && ticketAssignId) {
          return handleAdminAssignTicket({
            db,
            request,
            environment,
            ticketId: ticketAssignId,
          });
        }

        if (request.method === "POST" && ticketStatusId) {
          return handleTicketStatusUpdate({
            db,
            request,
            environment,
            ticketId: ticketStatusId,
          });
        }

        if (request.method === "POST" && ticketReviewId) {
          return handleResidentReviewSubmit({
            db,
            request,
            environment,
            ticketId: ticketReviewId,
          });
        }

        if (request.method === "GET" && url.pathname === "/resident/account") {
          return handleResidentAccountPage({ db, request, environment });
        }

        if (request.method === "GET" && url.pathname === "/resident/staff-ratings") {
          return handleResidentStaffRatingsPage({ db, request, environment });
        }

        if (request.method === "GET" && url.pathname === "/admin") {
          return handleRoleHome({ db, request, requiredRole: "admin", environment });
        }

        if (request.method === "GET" && url.pathname === "/admin/staff") {
          return handleAdminStaffRatingsPage({ db, request, environment });
        }

        if (request.method === "GET" && url.pathname === "/admin/account") {
          return handleAdminAccountPage({ db, request, environment });
        }

        if (request.method === "GET" && url.pathname === "/staff") {
          return handleRoleHome({ db, request, requiredRole: "staff", environment });
        }

        if (request.method === "GET" && url.pathname === "/staff/account") {
          return handleStaffAccountPage({ db, request, environment });
        }

        if (request.method === "GET" && url.pathname === "/403") {
          return renderForbidden({ db, request });
        }

        if (request.method === "GET" && url.pathname === "/404") {
          return renderNotFound({ db, request });
        }

        if (request.method === "GET" && url.pathname === "/500") {
          return renderServerError({
            request,
            error: new Error("Manual /500 route"),
          });
        }

        return renderNotFound({ db, request });
      } catch (error) {
        return renderServerError({ request, error });
      }
    },
  };
}
