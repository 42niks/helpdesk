import {
  doc,
  html,
  htmlEscape,
  issueTypeLabel,
  navWithLogout,
  ratingLabel,
  staffTypeLabel,
  statusLabel,
  ticketAgingBadge,
} from "./utils.mjs";

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

function adminTicketListHtml(tickets, nowMillis = Date.now()) {
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
        const agingBadge = ticketAgingBadge(ticket, nowMillis);
        const agingHtml = agingBadge
          ? `<p class="meta-row"><span class="badge">${htmlEscape(agingBadge)}</span></p>`
          : "";
        return [
          '<li class="ticket-item">',
          `<h3><a href="/tickets/${ticket.id}">${htmlEscape(ticket.ticket_number)}</a></h3>`,
          `<p class="meta-row"><strong>Flat:</strong> ${htmlEscape(ticket.resident_flat_number)}</p>`,
          `<p class="meta-row"><strong>Resident:</strong> ${htmlEscape(ticket.resident_name)}</p>`,
          `<p class="meta-row"><strong>Title:</strong> ${htmlEscape(ticket.title)}</p>`,
          `<p class="meta-row"><strong>Issue:</strong> ${htmlEscape(issueTypeLabel(ticket.issue_type))}</p>`,
          `<p class="meta-row"><strong>Status:</strong> ${htmlEscape(statusLabel(ticket.status))}</p>`,
          assignedHtml,
          agingHtml,
          `<p class="small">Created: ${htmlEscape(ticket.created_at)}</p>`,
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

function renderSubmittedReviewBlock({ review, ticket }) {
  if (!review) {
    return "";
  }
  return [
    "<h2>Submitted Review</h2>",
    '<div class="resident-meta">',
    `<p><strong>Staff:</strong> ${htmlEscape(review.staff_name || ticket.assigned_staff_name || "Unknown")}</p>`,
    `<p><strong>Rating:</strong> ${htmlEscape(ratingLabel(review.rating))}</p>`,
    review.review_text ? `<p><strong>Review:</strong> ${htmlEscape(review.review_text)}</p>` : "",
    `<p class="small">Submitted: ${htmlEscape(review.created_at)}</p>`,
    "</div>",
  ].join("");
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
  const submittedReviewHtml = renderSubmittedReviewBlock({ review, ticket });
  let reviewSectionHtml = "";
  if (ticket.status === "completed") {
    if (!review && !ticket.assigned_staff_account_id) {
      reviewSectionHtml = '<div class="message info">Review is not available because no staff was assigned.</div>';
    } else if (!review) {
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
        submittedReviewHtml,
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
  review = null,
  events,
  comments,
  assignableStaff = [],
  formState = {},
  responseCode = 200,
}) {
  const backLink = roleTicketBackLink(role);
  const links = [backLink, ...roleSecondaryLinks(role)];
  const submittedReviewHtml = renderSubmittedReviewBlock({ review, ticket });
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
        submittedReviewHtml,
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

export {
  residentTicketListHtml,
  adminTicketListHtml,
  staffTicketListHtml,
  createTicketPage,
  residentTicketDetailPage,
  residentPlaceholderPage,
  operatorTicketDetailPage,
};
