import {
  createCsrfToken,
  createSessionToken,
  hashSessionToken,
  verifyPassword,
} from "./security.mjs";

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
    'input[type="text"], input[type="password"] { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }',
    "button { margin-top: 0; width: auto; padding: 10px 12px; border: 1px solid #111; border-radius: 4px; background: #111; color: #fff; font-size: 1rem; }",
    ".wide-button { width: 100%; margin-top: 12px; }",
    ".nav-button { padding: 6px 10px; font-size: 0.9rem; }",
    ".action-form { margin: 12px 0; }",
    ".resident-meta { margin: 10px 0 12px; padding: 10px; background: #f7f9fc; border: 1px solid #dfe7f2; border-radius: 4px; }",
    ".resident-meta p { margin: 4px 0; }",
    ".message { padding: 10px; border-radius: 4px; margin: 12px 0; }",
    ".message.info { background: #eef3ff; border: 1px solid #c7d8ff; }",
    ".message.error { background: #fff0f0; border: 1px solid #f3c0c0; }",
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

function pageWithLogout({
  title,
  welcomeText,
  links,
  csrfToken,
  detailsHtml = "",
  primaryAction = null,
}) {
  const navLinks = links
    .map((entry) => `<a href="${entry.href}">${entry.label}</a>`)
    .join("");
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
      [
        "<nav>",
        '<form method="post" action="/logout">',
        `<input type="hidden" name="csrf_token" value="${htmlEscape(csrfToken)}">`,
        '<button type="submit" class="nav-button">Logout</button>',
        "</form>",
        navLinks,
        "</nav>",
      ].join(""),
      `<h1>${htmlEscape(title)}</h1>`,
      `<p>${htmlEscape(welcomeText)}</p>`,
      detailsHtml,
      actionHtml,
      '<p class="small">Milestone 1 baseline is active: auth/session/CSRF/login routing.</p>',
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

async function handleRoleHome({ db, request, requiredRole, environment }) {
  const authResult = await requireSession({ db, request, environment });
  if (authResult.response) {
    return authResult.response;
  }
  const { session } = authResult;
  if (session.role !== requiredRole) {
    return errorPage({
      status: 403,
      title: "Forbidden",
      message: "You are not allowed to open this page.",
      role: session.role,
      includeRetry: false,
      retryHref: "",
      details: "",
      requestIdValue: requestId(),
    });
  }

  if (requiredRole === "resident") {
    const residentProfile = await db.get(
      [
        "select ap.name as apartment_name, r.flat_number",
        "from residents r",
        "join apartments ap on ap.id = r.apartment_id",
        "where r.account_id = ?",
        "limit 1",
      ].join(" "),
      [session.accountId],
    );
    const apartmentName = residentProfile?.apartment_name || "Unknown";
    const flatNumber = residentProfile?.flat_number || "Unknown";
    return html(
      pageWithLogout({
        title: "Resident Home (All Tickets)",
        welcomeText: `Logged in as ${session.username}.`,
        csrfToken: session.csrfToken,
        detailsHtml: [
          '<div class="resident-meta">',
          `<p><strong>Apartment:</strong> ${htmlEscape(apartmentName)}</p>`,
          `<p><strong>Flat:</strong> ${htmlEscape(flatNumber)}</p>`,
          "</div>",
        ].join(""),
        primaryAction: {
          method: "get",
          href: "/tickets/new",
          label: "Create Ticket",
        },
        links: [
          { href: "/resident/staff-ratings", label: "Resident Staff Ratings" },
          { href: "/resident/account", label: "Profile" },
        ],
      }),
    );
  }
  if (requiredRole === "admin") {
    const adminProfile = await db.get(
      [
        "select ap.name as apartment_name",
        "from admins ad",
        "join apartments ap on ap.id = ad.apartment_id",
        "where ad.account_id = ?",
        "limit 1",
      ].join(" "),
      [session.accountId],
    );
    const apartmentName = adminProfile?.apartment_name || "Unknown";
    return html(
      pageWithLogout({
        title: "Admin Home (All Tickets)",
        welcomeText: `Logged in as ${session.username}.`,
        csrfToken: session.csrfToken,
        detailsHtml: [
          '<div class="resident-meta">',
          `<p><strong>Apartment:</strong> ${htmlEscape(apartmentName)}</p>`,
          "<p><strong>Flat:</strong> N/A (Admin account)</p>",
          "</div>",
        ].join(""),
        links: [
          { href: "/admin/staff", label: "Apartment Staff Performance" },
          { href: "/admin/account", label: "Profile" },
        ],
      }),
    );
  }

  return html(
    pageWithLogout({
      title: "Staff Home (Assigned Tickets)",
      welcomeText: `Logged in as ${session.username}.`,
      csrfToken: session.csrfToken,
      links: [{ href: "/staff/account", label: "Staff Account" }],
    }),
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

        if (request.method === "GET" && url.pathname === "/admin") {
          return handleRoleHome({ db, request, requiredRole: "admin", environment });
        }

        if (request.method === "GET" && url.pathname === "/staff") {
          return handleRoleHome({ db, request, requiredRole: "staff", environment });
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
