import {
  handleLogin,
  actorForRequestLog,
} from "./auth/session.mjs";
import {
  handleSharedTicketDetail,
  handleTicketComment,
} from "./tickets/context.mjs";
import {
  handleAdminAssignTicket,
  handleResidentReviewSubmit,
  handleTicketStatusUpdate,
} from "./tickets/management-handlers.mjs";
import {
  handleRoleHome,
} from "./pages/role-home.mjs";
import {
  handleResidentCreateTicket,
  handleResidentCreateTicketPage,
} from "./tickets/resident-handlers.mjs";
import {
  handleResidentAccountPage,
  handleResidentStaffRatingsPage,
} from "./pages/resident-pages.mjs";
import {
  handleAdminAccountPage,
  handleAdminStaffRatingsPage,
  handleStaffAccountPage,
} from "./pages/admin-staff-pages.mjs";
import {
  handleLogout,
  renderForbidden,
  renderNotFound,
  renderServerError,
} from "./errors/handlers.mjs";
import {
  html,
  loginPage,
  logRequestRecord,
  parseTicketId,
  requestId,
  text,
} from "./core/utils.mjs";

export function createApp({ db, environment = "local" }) {
  return {
    async fetch(request) {
      const requestIdValue = requestId();
      const startedAtMs = Date.now();
      let actor = null;
      try {
        actor = await actorForRequestLog({ db, request });
      } catch {
      }

      const finish = (response) => {
        logRequestRecord({
          requestIdValue,
          request,
          response,
          actor,
          startedAtMs,
        });
        return response;
      };

      try {
        const url = new URL(request.url);
        const ticketDetailId = parseTicketId(url.pathname, /^\/tickets\/(\d+)$/);
        const ticketCommentId = parseTicketId(url.pathname, /^\/tickets\/(\d+)\/comments$/);
        const ticketAssignId = parseTicketId(url.pathname, /^\/tickets\/(\d+)\/assign$/);
        const ticketStatusId = parseTicketId(url.pathname, /^\/tickets\/(\d+)\/status$/);
        const ticketReviewId = parseTicketId(url.pathname, /^\/tickets\/(\d+)\/review$/);

        if (url.pathname === "/_health/") {
          return finish(text("ok"));
        }

        if (url.pathname === "/_db/") {
          try {
            const row = await db.get("select value from meta where key = 'schema_version'");
            return finish(text(`db ok (schema_version=${row?.value ?? "unknown"})`));
          } catch (error) {
            return finish(text(`db error: ${String(error)}`, 500));
          }
        }

        if (request.method === "GET" && url.pathname === "/") {
          return finish(html(loginPage({ reason: url.searchParams.get("reason") || "" })));
        }

        if (request.method === "POST" && url.pathname === "/login") {
          return finish(await handleLogin({ db, request, environment }));
        }

        if (request.method === "POST" && url.pathname === "/logout") {
          return finish(await handleLogout({ db, request, environment }));
        }

        if (request.method === "GET" && url.pathname === "/resident") {
          return finish(await handleRoleHome({ db, request, requiredRole: "resident", environment }));
        }

        if (request.method === "GET" && url.pathname === "/tickets/new") {
          return finish(await handleResidentCreateTicketPage({ db, request, environment }));
        }

        if (request.method === "POST" && url.pathname === "/tickets") {
          return finish(await handleResidentCreateTicket({
            db,
            request,
            environment,
            requestIdValue,
          }));
        }

        if (request.method === "GET" && ticketDetailId) {
          return finish(await handleSharedTicketDetail({
            db,
            request,
            environment,
            ticketId: ticketDetailId,
          }));
        }

        if (request.method === "POST" && ticketCommentId) {
          return finish(await handleTicketComment({
            db,
            request,
            environment,
            ticketId: ticketCommentId,
            requestIdValue,
          }));
        }

        if (request.method === "POST" && ticketAssignId) {
          return finish(await handleAdminAssignTicket({
            db,
            request,
            environment,
            ticketId: ticketAssignId,
            requestIdValue,
          }));
        }

        if (request.method === "POST" && ticketStatusId) {
          return finish(await handleTicketStatusUpdate({
            db,
            request,
            environment,
            ticketId: ticketStatusId,
            requestIdValue,
          }));
        }

        if (request.method === "POST" && ticketReviewId) {
          return finish(await handleResidentReviewSubmit({
            db,
            request,
            environment,
            ticketId: ticketReviewId,
            requestIdValue,
          }));
        }

        if (request.method === "GET" && url.pathname === "/resident/account") {
          return finish(await handleResidentAccountPage({ db, request, environment }));
        }

        if (request.method === "GET" && url.pathname === "/resident/staff-ratings") {
          return finish(await handleResidentStaffRatingsPage({ db, request, environment }));
        }

        if (request.method === "GET" && url.pathname === "/admin") {
          return finish(await handleRoleHome({ db, request, requiredRole: "admin", environment }));
        }

        if (request.method === "GET" && url.pathname === "/admin/staff") {
          return finish(await handleAdminStaffRatingsPage({ db, request, environment }));
        }

        if (request.method === "GET" && url.pathname === "/admin/account") {
          return finish(await handleAdminAccountPage({ db, request, environment }));
        }

        if (request.method === "GET" && url.pathname === "/staff") {
          return finish(await handleRoleHome({ db, request, requiredRole: "staff", environment }));
        }

        if (request.method === "GET" && url.pathname === "/staff/account") {
          return finish(await handleStaffAccountPage({ db, request, environment }));
        }

        if (request.method === "GET" && url.pathname === "/403") {
          return finish(await renderForbidden({ db, request, requestIdValue }));
        }

        if (request.method === "GET" && url.pathname === "/404") {
          return finish(await renderNotFound({ db, request, requestIdValue }));
        }

        if (request.method === "GET" && url.pathname === "/500") {
          return finish(await renderServerError({
            db,
            request,
            error: new Error("Manual /500 route"),
            requestIdValue,
          }));
        }

        return finish(await renderNotFound({ db, request, requestIdValue }));
      } catch (error) {
        const response = await renderServerError({ db, request, error, requestIdValue });
        return finish(response);
      }
    },
  };
}
