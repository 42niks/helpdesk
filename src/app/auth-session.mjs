import {
  createCsrfToken,
  createSessionToken,
  hashSessionToken,
  verifyPassword,
} from "./security.mjs";
import {
  findAccountForLogin,
} from "./data.mjs";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_HOURS,
  actorLogShape,
  addHours,
  clearSessionCookie,
  errorPage,
  html,
  now,
  parseCookies,
  parseForm,
  redirect,
  requestId,
  roleHome,
  sessionCookie,
  loginPage,
} from "./utils.mjs";

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

export async function revokeSession(db, sessionId, currentTime) {
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

export async function requireSession({ db, request, environment }) {
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

export async function activeSessionFromRequest({ db, request }) {
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
  return session;
}

export async function sessionRoleForErrorPage({ db, request }) {
  const session = await activeSessionFromRequest({ db, request });
  return session?.role || null;
}

export async function actorForRequestLog({ db, request }) {
  const session = await activeSessionFromRequest({ db, request });
  return actorLogShape(session);
}

export async function handleLogin({ db, request, environment }) {
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

export function forbiddenForRole(
  session,
  message = "You are not allowed to open this page.",
  requestIdValue = requestId(),
) {
  return errorPage({
    status: 403,
    title: "Forbidden",
    message,
    role: session.role,
    includeRetry: false,
    retryHref: "",
    details: "",
    requestIdValue,
  });
}

export function csrfForbiddenForRole(session, requestIdValue = requestId()) {
  return errorPage({
    status: 403,
    title: "Forbidden",
    message: "CSRF validation failed.",
    role: session.role,
    includeRetry: false,
    retryHref: "",
    details: "",
    requestIdValue,
  });
}
