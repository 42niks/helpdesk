import {
  countResidentActiveTickets,
  createResidentTicket,
} from "./data.mjs";
import {
  validateTicketCreateInput,
} from "./tickets-validation.mjs";
import {
  createTicketPage,
} from "./views.mjs";
import {
  actorLogShape,
  html,
  logMutationRecord,
  parseForm,
  redirect,
  requestId,
} from "./utils.mjs";
import {
  csrfForbiddenForRole,
} from "./auth-session.mjs";
import {
  requireResidentSession,
} from "./role-session-guards.mjs";

export async function handleResidentCreateTicketPage({ db, request, environment }) {
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

export async function handleResidentCreateTicket({ db, request, environment, requestIdValue = requestId() }) {
  const residentAuth = await requireResidentSession({ db, request, environment });
  if (residentAuth.response) {
    return residentAuth.response;
  }

  const { session, residentProfile } = residentAuth;
  const form = await parseForm(request);
  if (!form.csrf_token || form.csrf_token !== session.csrfToken) {
    return csrfForbiddenForRole(session, requestIdValue);
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
  logMutationRecord({
    requestIdValue,
    route: "/tickets",
    action: "ticket_created",
    ticketId,
    actor: actorLogShape(session),
    details: {
      issue_type: validation.values.issue_type,
    },
  });

  return redirect(`/tickets/${ticketId}`);
}
