import {
  getAdminTicketById,
  getResidentTicketById,
  getTicketReview,
  hasActiveStaffApartmentLink,
  loadAssigneeForAssignment,
} from "./data.mjs";
import {
  validateReviewInput,
} from "./tickets-validation.mjs";
import {
  actorLogShape,
  issueTypeToStaffType,
  logMutationRecord,
  now,
  parseForm,
  parsePositiveInt,
  redirect,
  requestId,
} from "./utils.mjs";
import {
  csrfForbiddenForRole,
  forbiddenForRole,
  requireSession,
} from "./auth-session.mjs";
import {
  requireAdminSession,
  requireResidentSession,
} from "./role-session-guards.mjs";
import {
  getTicketContextForSession,
  renderTicketDetailForContext,
} from "./ticket-context.mjs";
import {
  renderNotFound,
} from "./error-handlers.mjs";

export async function handleAdminAssignTicket({ db, request, environment, ticketId, requestIdValue = requestId() }) {
  const adminAuth = await requireAdminSession({ db, request, environment });
  if (adminAuth.response) {
    return adminAuth.response;
  }
  const { session, adminProfile } = adminAuth;

  const form = await parseForm(request);
  if (!form.csrf_token || form.csrf_token !== session.csrfToken) {
    return csrfForbiddenForRole(session, requestIdValue);
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

  logMutationRecord({
    requestIdValue,
    route: `/tickets/${ticketId}/assign`,
    action: isReassignment ? "ticket_reassigned" : "ticket_assigned",
    ticketId,
    actor: actorLogShape(session),
    details: {
      to_staff_account_id: staffAccountId,
    },
  });

  return redirect(`/tickets/${ticketId}`);
}

export async function handleTicketStatusUpdate({ db, request, environment, ticketId, requestIdValue = requestId() }) {
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
    logMutationRecord({
      requestIdValue,
      route: `/tickets/${ticketId}/status`,
      action: "ticket_status_changed",
      ticketId,
      actor: actorLogShape(session),
      details: {
        from_status: ticket.status,
        to_status: nextStatus,
      },
    });
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

    logMutationRecord({
      requestIdValue,
      route: `/tickets/${ticketId}/status`,
      action: "ticket_admin_completed_cancel",
      ticketId,
      actor: actorLogShape(session),
      details: {
        from_status: ticket.status,
        to_status: "completed",
      },
    });

    return redirect(`/tickets/${ticketId}`);
  }

  return forbiddenForRole(session);
}

export async function handleResidentReviewSubmit({ db, request, environment, ticketId, requestIdValue = requestId() }) {
  const residentAuth = await requireResidentSession({ db, request, environment });
  if (residentAuth.response) {
    return residentAuth.response;
  }
  const { session, residentProfile } = residentAuth;

  const form = await parseForm(request);
  if (!form.csrf_token || form.csrf_token !== session.csrfToken) {
    return csrfForbiddenForRole(session, requestIdValue);
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

  logMutationRecord({
    requestIdValue,
    route: `/tickets/${ticketId}/review`,
    action: "ticket_review_submitted",
    ticketId,
    actor: actorLogShape(session),
    details: {
      rating: validation.values.rating,
    },
  });

  return redirect(`/tickets/${ticketId}`);
}
