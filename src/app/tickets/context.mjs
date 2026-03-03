import {
  getAdminProfile,
  getAdminTicketById,
  getResidentProfile,
  getResidentTicketById,
  getStaffProfile,
  getStaffTicketById,
  getTicketReview,
  listAssignableStaff,
  listTicketComments,
  listTicketEvents,
} from "../core/data.mjs";
import {
  validateCommentInput,
} from "./validation.mjs";
import {
  operatorTicketDetailPage,
  residentTicketDetailPage,
} from "../core/views.mjs";
import {
  actorLogShape,
  logMutationRecord,
  now,
  parseForm,
  redirect,
  requestId,
} from "../core/utils.mjs";
import {
  csrfForbiddenForRole,
  forbiddenForRole,
  requireSession,
} from "../auth/session.mjs";
import {
  renderNotFound,
} from "../errors/handlers.mjs";

export async function getTicketContextForSession({ db, session, ticketId }) {
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

export async function renderTicketDetailForContext({
  db,
  session,
  context,
  responseCode = 200,
  formState = {},
}) {
  const [events, comments, review] = await Promise.all([
    listTicketEvents(db, context.ticket.id),
    listTicketComments(db, context.ticket.id),
    getTicketReview(db, context.ticket.id),
  ]);

  if (context.viewerRole === "resident") {
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
    review,
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

export async function handleSharedTicketDetail({ db, request, environment, ticketId }) {
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

export async function handleTicketComment({ db, request, environment, ticketId, requestIdValue = requestId() }) {
  const authResult = await requireSession({ db, request, environment });
  if (authResult.response) {
    return authResult.response;
  }
  const { session } = authResult;

  const form = await parseForm(request);
  if (!form.csrf_token || form.csrf_token !== session.csrfToken) {
    return csrfForbiddenForRole(session, requestIdValue);
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
  await db.transaction(async () => {
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
  });

  logMutationRecord({
    requestIdValue,
    route: `/tickets/${ticketId}/comments`,
    action: "comment_added",
    ticketId,
    actor: actorLogShape(session),
  });

  return redirect(`/tickets/${ticketId}`);
}
