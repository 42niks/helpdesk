import {
  csrfForbiddenForRole,
  requireSession,
  revokeSession,
  sessionRoleForErrorPage,
} from "../auth/session.mjs";
import {
  clearSessionCookie,
  errorPage,
  now,
  parseForm,
  redirect,
  requestId,
} from "../core/utils.mjs";

export async function handleLogout({ db, request, environment }) {
  const authResult = await requireSession({ db, request, environment });
  if (authResult.response) {
    return authResult.response;
  }
  const { session } = authResult;
  const form = await parseForm(request);
  if (!form.csrf_token || form.csrf_token !== session.csrfToken) {
    return csrfForbiddenForRole(session, requestId());
  }
  await revokeSession(db, session.sessionId, now());
  return redirect("/?reason=logged_out", {
    "set-cookie": clearSessionCookie(environment),
  });
}

export async function renderForbidden({ db, request, requestIdValue = requestId() }) {
  const role = await sessionRoleForErrorPage({ db, request });
  return errorPage({
    status: 403,
    title: "Forbidden",
    message: "You are not allowed to do that.",
    role,
    includeRetry: false,
    retryHref: "",
    details: "",
    requestIdValue,
  });
}

export async function renderNotFound({ db, request, requestIdValue = requestId() }) {
  const role = await sessionRoleForErrorPage({ db, request });
  return errorPage({
    status: 404,
    title: "Not Found",
    message: "The page you requested was not found.",
    role,
    includeRetry: false,
    retryHref: "",
    details: "",
    requestIdValue,
  });
}

export async function renderServerError({ db, request, error, requestIdValue = requestId() }) {
  const details = error instanceof Error ? `${error.message}\n\n${error.stack || ""}` : String(error);
  const role = await sessionRoleForErrorPage({ db, request });
  return errorPage({
    status: 500,
    title: "Error",
    message: "An unexpected server error occurred.",
    role,
    includeRetry: true,
    retryHref: new URL(request.url).pathname || "/",
    details,
    requestIdValue,
  });
}
