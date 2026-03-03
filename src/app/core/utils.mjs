const RUNTIME_ENV = globalThis.process?.env || {};
const SESSION_COOKIE_NAME = RUNTIME_ENV.SESSION_COOKIE_NAME || "helpdesk_session";
const SESSION_TTL_HOURS = Number.parseInt(RUNTIME_ENV.SESSION_TTL_HOURS || "168", 10);
const ADMIN_QUEUE_ALLOWED_PAGE_SIZES = new Set([10, 20, 50]);
const ADMIN_QUEUE_DEFAULT_PAGE_SIZE = 20;
const ADMIN_QUEUE_MAX_PAGE_SIZE = 100;

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
    "body { margin: 0; padding: 0; font-family: Arial, sans-serif; background: #f5f7fa; color: #111; line-height: 1.5; }",
    "main { max-width: min(520px, 100vw); margin: 0 auto; min-height: 100vh; box-sizing: border-box; padding: 20px 16px 24px; background: #fff; }",
    "h1 { font-size: 1.5rem; margin: 0 0 16px; line-height: 1.3; }",
    "h2 { font-size: 1.2rem; margin: 20px 0 10px; line-height: 1.35; }",
    "p { margin: 8px 0; line-height: 1.5; }",
    "nav { margin: 0 0 16px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }",
    "nav form { margin: 0; }",
    "nav a { font-size: 0.9rem; }",
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
    ".ticket-item, .timeline-item, .comment-item { border: 1px solid #dfe7f2; border-radius: 4px; padding: 12px; background: #fff; }",
    ".ticket-item h3 { margin: 0 0 6px; font-size: 1.05rem; }",
    ".meta-row { margin: 4px 0; }",
    ".small { color: #444; font-size: 0.95rem; }",
    ".page-subtitle { margin: 4px 0 16px; color: #444; font-size: 0.95rem; }",
    ".section { margin-top: 20px; }",
    ".section-header { margin-bottom: 8px; display: flex; justify-content: space-between; align-items: baseline; }",
    ".section-header h2 { margin: 0; }",
    ".empty-state { margin: 12px 0; color: #555; font-size: 0.95rem; }",
    ".badge { display: inline-block; padding: 2px 6px; border-radius: 999px; font-size: 0.85rem; line-height: 1.3; border: 1px solid #dfe7f2; background: #f7f9fc; }",
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

function actorLogShape(session) {
  if (!session) {
    return null;
  }
  return {
    account_id: session.accountId,
    username: session.username,
    role: session.role,
  };
}

function writeStructuredLog(payload) {
  try {
    console.log(JSON.stringify(payload));
  } catch {}
}

function logRequestRecord({ requestIdValue, request, response, actor, startedAtMs }) {
  const durationMs = Math.max(0, Date.now() - startedAtMs);
  const url = new URL(request.url);
  writeStructuredLog({
    event: "request",
    request_id: requestIdValue,
    method: request.method,
    route: url.pathname,
    status: response.status,
    duration_ms: durationMs,
    actor,
    ts: new Date().toISOString(),
  });
}

function logMutationRecord({
  requestIdValue,
  route,
  action,
  ticketId,
  actor,
  details = {},
}) {
  writeStructuredLog({
    event: "mutation",
    request_id: requestIdValue,
    route,
    action,
    ticket_id: ticketId,
    actor,
    details,
    ts: new Date().toISOString(),
  });
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
      '<p class="page-subtitle">Apartment maintenance helpdesk for residents, admins, and staff.</p>',
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

function parseAdminQueueFilters(url) {
  const statusRaw = (url.searchParams.get("status") || "").trim().toLowerCase();
  const issueTypeRaw = (url.searchParams.get("issue_type") || "").trim().toLowerCase();
  const assignedStaffRaw = (url.searchParams.get("assigned_staff") || "").trim().toLowerCase();

  const status = ["open", "assigned", "in_progress", "completed"].includes(statusRaw) ? statusRaw : "";
  const issueType = ["electrical", "plumbing"].includes(issueTypeRaw) ? issueTypeRaw : "";

  let assignedStaff = "";
  if (assignedStaffRaw === "unassigned") {
    assignedStaff = "unassigned";
  } else {
    const parsedStaffId = parsePositiveInt(assignedStaffRaw);
    if (parsedStaffId) {
      assignedStaff = String(parsedStaffId);
    }
  }

  const page = parsePositiveInt(url.searchParams.get("page")) || 1;
  const parsedPageSize = parsePositiveInt(url.searchParams.get("page_size"));
  const pageSize = parsedPageSize
    ? Math.min(parsedPageSize, ADMIN_QUEUE_MAX_PAGE_SIZE)
    : ADMIN_QUEUE_DEFAULT_PAGE_SIZE;

  return {
    status,
    issueType,
    assignedStaff,
    page,
    pageSize,
  };
}

function parseIsoToMillis(value) {
  const millis = Date.parse(value || "");
  if (Number.isNaN(millis)) {
    return null;
  }
  return millis;
}

function ticketAgingBadge(ticket, nowMillis) {
  if (ticket.status === "open" && !ticket.assigned_staff_account_id) {
    const createdMillis = parseIsoToMillis(ticket.created_at);
    if (createdMillis !== null && nowMillis - createdMillis >= 24 * 60 * 60 * 1000) {
      return "Unassigned >24h";
    }
  }

  if (ticket.status === "in_progress") {
    const startedMillis = parseIsoToMillis(ticket.in_progress_at || ticket.updated_at || ticket.created_at);
    if (startedMillis !== null && nowMillis - startedMillis >= 72 * 60 * 60 * 1000) {
      return "In Progress >72h";
    }
  }

  return "";
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

export {
  SESSION_COOKIE_NAME,
  SESSION_TTL_HOURS,
  now,
  addHours,
  doc,
  htmlEscape,
  parseCookies,
  text,
  html,
  roleHome,
  roleHomeLabel,
  sessionCookie,
  clearSessionCookie,
  redirect,
  requestId,
  actorLogShape,
  logRequestRecord,
  logMutationRecord,
  loginPage,
  navWithLogout,
  pageWithLogout,
  errorPage,
  parseForm,
  issueTypeLabel,
  issueTypeToStaffType,
  staffTypeLabel,
  statusLabel,
  formatTicketNumber,
  parsePositiveInt,
  parseAdminQueueFilters,
  ticketAgingBadge,
  ratingLabel,
  formatAverageRating,
  parseTicketId,
};
