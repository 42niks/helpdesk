import {
  doc,
  html,
  htmlEscape,
  issueTypeLabel,
  logoutPanel,
  navWithLogout,
  ratingLabel,
  staffTypeLabel,
  statusLabel,
  ticketAgingBadge,
} from "./utils.mjs";

function statusChip(status) {
  return `<span class="status-chip status-chip--${htmlEscape(status)}">${htmlEscape(statusLabel(status))}</span>`;
}

function relativeUpdatedLabel(isoValue, nowMillis = Date.now()) {
  const updatedMs = Date.parse(isoValue);
  if (!Number.isFinite(updatedMs)) {
    return "Updated recently";
  }
  const deltaMs = Math.max(0, nowMillis - updatedMs);
  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 1) {
    return "Updated just now";
  }
  if (minutes < 60) {
    return `Updated ${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Updated ${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `Updated ${days}d ago`;
  }
  const months = Math.floor(days / 30);
  if (months < 12) {
    return `Updated ${months}mo ago`;
  }
  const years = Math.floor(months / 12);
  return `Updated ${years}y ago`;
}

function relativeTimeAgo(isoValue, nowMillis = Date.now()) {
  const parsedMs = Date.parse(isoValue || "");
  if (!Number.isFinite(parsedMs)) {
    return "recently";
  }
  const deltaMs = Math.max(0, nowMillis - parsedMs);
  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}d ago`;
  }
  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months}mo ago`;
  }
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

const DETAIL_DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

function formatDetailDateTime(isoValue) {
  const parsed = Date.parse(isoValue || "");
  if (!Number.isFinite(parsed)) {
    return isoValue || "Unknown";
  }
  return DETAIL_DATE_FORMAT.format(new Date(parsed));
}

function commentAuthorLabel(role) {
  if (role === "resident") {
    return "Resident";
  }
  if (role === "admin") {
    return "Apartment Admin";
  }
  if (role === "staff") {
    return "Assigned Staff";
  }
  return role || "Unknown";
}

function mergeResidentTimelineEntries(events, comments) {
  const combined = [
    ...events.map((event, index) => ({
      kind: "event",
      created_at: event.created_at,
      index,
      event,
    })),
    ...comments.map((comment, index) => ({
      kind: "comment",
      created_at: comment.created_at,
      index,
      comment,
    })),
  ];
  combined.sort((a, b) => {
    const aMs = Date.parse(a.created_at || "");
    const bMs = Date.parse(b.created_at || "");
    const aValid = Number.isFinite(aMs);
    const bValid = Number.isFinite(bMs);
    if (aValid && bValid && aMs !== bMs) {
      return aMs - bMs;
    }
    if (aValid !== bValid) {
      return aValid ? -1 : 1;
    }
    if (a.kind !== b.kind) {
      return a.kind === "event" ? -1 : 1;
    }
    return a.index - b.index;
  });
  return combined;
}

function metaChip(text, variant = "") {
  const classSuffix = variant ? ` ticket-meta-chip--${variant}` : "";
  return `<span class="ticket-meta-chip${classSuffix}">${htmlEscape(text)}</span>`;
}

function kvGrid(rows) {
  return [
    '<div class="resident-meta kv-grid">',
    rows
      .map(([label, value]) => `<p><strong>${htmlEscape(label)}</strong> ${htmlEscape(value)}</p>`)
      .join(""),
    "</div>",
  ].join("");
}

function kvGridHtml(rows) {
  return [
    '<div class="resident-meta kv-grid">',
    rows
      .map(([label, valueHtml]) => `<p><strong>${htmlEscape(label)}</strong> ${valueHtml}</p>`)
      .join(""),
    "</div>",
  ].join("");
}

function ticketLifecycleProgress(status) {
  const orderedStatuses = ["open", "assigned", "in_progress", "completed"];
  const activeIndex = Math.max(0, orderedStatuses.indexOf(status));
  const labels = orderedStatuses.map((entry) => statusLabel(entry));
  return [
    '<ol class="ticket-progress-line" aria-label="Ticket lifecycle progress">',
    orderedStatuses
      .map((entry, index) => {
        const stepClass = index < activeIndex
          ? "ticket-progress-stop--done"
          : index === activeIndex
            ? "ticket-progress-stop--current"
            : "ticket-progress-stop--pending";
        return [
          `<li class="ticket-progress-stop ${stepClass}">`,
          `<span class="ticket-progress-dot" aria-hidden="true"></span>`,
          `<span class="ticket-progress-label">${htmlEscape(labels[index])}</span>`,
          "</li>",
        ].join("");
      })
      .join(""),
    "</ol>",
  ].join("");
}

function residentTicketListHtml(tickets) {
  if (tickets.length === 0) {
    return '<p class="empty-state">No tickets yet. Use Create Ticket to open your first request.</p>';
  }
  return [
    '<ul class="ticket-list">',
    tickets
      .map((ticket) => {
        const assignedLabel = ticket.assigned_staff_name || "Unassigned";
        const updatedLabel = relativeUpdatedLabel(ticket.updated_at);
        return [
          `<li class="ticket-item ticket-item--${htmlEscape(ticket.status)}">`,
          `<a class="ticket-item-link" href="/tickets/${ticket.id}">`,
          '<div class="ticket-row-head">',
          `<h3><span class="ticket-number-link">${htmlEscape(ticket.ticket_number)}</span></h3>`,
          statusChip(ticket.status),
          "</div>",
          `<p class="ticket-row-title">${htmlEscape(ticket.title)}</p>`,
          '<p class="ticket-row-meta-chips">',
          metaChip(issueTypeLabel(ticket.issue_type), "issue"),
          metaChip(assignedLabel, "assignee"),
          metaChip(updatedLabel, "updated"),
          "</p>",
          "</a>",
          "</li>",
        ].join("");
      })
      .join(""),
    "</ul>",
  ].join("");
}

function adminTicketListHtml(tickets, nowMillis = Date.now()) {
  if (tickets.length === 0) {
    return '<p class="empty-state">No tickets in this apartment yet.</p>';
  }
  return [
    '<ul class="ticket-list">',
    tickets
      .map((ticket) => {
        const assignedLabel = ticket.assigned_staff_name || "Unassigned";
        const agingBadge = ticketAgingBadge(ticket, nowMillis);
        const updatedLabel = relativeUpdatedLabel(ticket.updated_at, nowMillis);
        return [
          `<li class="ticket-item ticket-item--${htmlEscape(ticket.status)}">`,
          `<a class="ticket-item-link" href="/tickets/${ticket.id}">`,
          '<div class="ticket-row-head">',
          `<h3><span class="ticket-number-link">${htmlEscape(ticket.ticket_number)}</span></h3>`,
          statusChip(ticket.status),
          "</div>",
          `<p class="ticket-row-title">${htmlEscape(ticket.title)}</p>`,
          '<p class="ticket-row-meta-chips">',
          metaChip(`Flat ${ticket.resident_flat_number}`, "flat"),
          metaChip(ticket.resident_name, "resident"),
          metaChip(issueTypeLabel(ticket.issue_type), "issue"),
          metaChip(assignedLabel, "assignee"),
          metaChip(updatedLabel, "updated"),
          agingBadge ? metaChip(agingBadge, "aging") : "",
          "</p>",
          "</a>",
          "</li>",
        ].join("");
      })
      .join(""),
    "</ul>",
  ].join("");
}

function staffTicketListHtml(tickets) {
  if (tickets.length === 0) {
    return '<p class="empty-state">No assigned active tickets right now.</p>';
  }
  return [
    '<ul class="ticket-list">',
    tickets
      .map((ticket) =>
        (() => {
          const updatedLabel = relativeUpdatedLabel(ticket.updated_at);
          return [
          `<li class="ticket-item ticket-item--${htmlEscape(ticket.status)}">`,
          `<a class="ticket-item-link" href="/tickets/${ticket.id}">`,
          '<div class="ticket-row-head">',
          `<h3><span class="ticket-number-link">${htmlEscape(ticket.ticket_number)}</span></h3>`,
          statusChip(ticket.status),
          "</div>",
          `<p class="ticket-row-title">${htmlEscape(ticket.title)}</p>`,
          '<p class="ticket-row-meta-chips">',
          metaChip(ticket.apartment_name, "apartment"),
          metaChip(`Flat ${ticket.resident_flat_number}`, "flat"),
          metaChip(issueTypeLabel(ticket.issue_type), "issue"),
          metaChip(updatedLabel, "updated"),
          "</p>",
          "</a>",
          "</li>",
          ].join("");
        })(),
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
  const selectedIssueType = issueType === "plumbing" ? "plumbing" : "electrical";
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
    "Create Ticket",
    [
      navWithLogout({
        csrfToken: session.csrfToken,
        links: [
          { href: "/resident", label: "← Home", className: "nav-home-pill" },
          { label: `Active Tickets: ${activeTicketCount}/5`, className: "nav-link-right nav-meta" },
        ],
      }),
      '<header class="page-header resident-home-header">',
      "<h1>Create Ticket</h1>",
      '<p class="page-subtitle">Create a maintenance request with clear details.</p>',
      "</header>",
      formErrorHtml,
      capHtml,
      '<form method="post" action="/tickets" novalidate>',
      `<input type="hidden" name="csrf_token" value="${htmlEscape(session.csrfToken)}">`,
      '<label id="issue_type_label">Issue Type</label>',
      '<p class="small issue-toggle-help">Choose one (required)</p>',
      '<div class="issue-toggle" role="radiogroup" aria-labelledby="issue_type_label">',
      '<label class="issue-toggle-option">',
      `<input type="radio" name="issue_type" value="electrical"${selectedIssueType === "electrical" ? " checked" : ""}>`,
      '<span><span class="issue-toggle-text">Electrical</span><span class="issue-toggle-selected">✓ Selected</span></span>',
      "</label>",
      '<label class="issue-toggle-option">',
      `<input type="radio" name="issue_type" value="plumbing"${selectedIssueType === "plumbing" ? " checked" : ""}>`,
      '<span><span class="issue-toggle-text">Plumbing</span><span class="issue-toggle-selected">✓ Selected</span></span>',
      "</label>",
      "</div>",
      issueTypeError,
      '<label for="title">Title</label>',
      `<input id="title" name="title" type="text" value="${htmlEscape(title)}" required>`,
      titleError,
      '<label for="description">Description</label>',
      `<textarea id="description" name="description" required>${htmlEscape(description)}</textarea>`,
      descriptionError,
      '<div class="form-actions">',
      '<a href="/resident" class="button-link button-cancel">Cancel</a>',
      `<button type="submit" class="button-create"${canCreate ? "" : " disabled"}>Create</button>`,
      "</div>",
      "</form>",
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
    '<section class="section">',
    "<h2>Submitted Review</h2>",
    kvGrid([
      ["Staff:", review.staff_name || ticket.assigned_staff_name || "Unknown"],
      ["Rating:", ratingLabel(review.rating)],
      ["Submitted:", formatDetailDateTime(review.created_at)],
    ]),
    review.review_text ? `<p class="meta-row"><strong>Review:</strong> ${htmlEscape(review.review_text)}</p>` : "",
    "</section>",
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
  const nowMillis = Date.now();
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
    ? (() => {
      const technicianStatus = ticket.status === "in_progress"
        ? "On it"
        : ticket.status === "assigned"
          ? "Yet to start"
          : "";
      const assignedAt = ticket.assigned_at || ticket.updated_at;
      const assignedAtExact = formatDetailDateTime(assignedAt);
      const assignedAtAgo = relativeTimeAgo(assignedAt, nowMillis);
      const phoneNumber = ticket.assigned_staff_mobile_number || "";
      const phoneHref = phoneNumber
        ? String(phoneNumber).replace(/[^\d+]/g, "")
        : "";
      return [
        '<section class="section">',
        "<h2>Assigned Technician</h2>",
        '<article class="resident-meta assigned-tech-card">',
        '<p class="assigned-tech-row assigned-tech-name-row"><strong>Name:</strong> ',
        `<span class="assigned-tech-name-value">${htmlEscape(ticket.assigned_staff_name)}</span>`,
        technicianStatus ? `<span class="assigned-tech-status-text">${htmlEscape(technicianStatus)}</span>` : "",
        "</p>",
        '<p class="assigned-tech-row assigned-tech-assigned-row"><strong>Assigned:</strong> ',
        `<span class="assigned-tech-assigned-value">${htmlEscape(assignedAtExact)}</span>`,
        `<span class="assigned-tech-assigned-ago">${htmlEscape(assignedAtAgo)}</span>`,
        "</p>",
        '<p class="assigned-tech-row assigned-tech-contact-row"><strong>Contact:</strong> ',
        `<span class="assigned-tech-contact-value">${phoneNumber ? htmlEscape(phoneNumber) : "Not available"}</span>`,
        phoneHref
          ? `<a class="assigned-tech-call-button assigned-tech-call-button--icon" href="tel:${htmlEscape(phoneHref)}" aria-label="Call technician">📞</a>`
          : "",
        "</p>",
        "</article>",
        "</section>",
      ].join("");
    })()
    : [
      '<section class="section">',
      "<h2>Assigned Technician</h2>",
      '<p class="empty-state">Not assigned yet. You can add a comment for priority context.</p>',
      "</section>",
    ].join("");
  const timelineEntries = mergeResidentTimelineEntries(events, comments);
  const eventsHtml = timelineEntries.length
    ? [
      '<ul class="timeline">',
      timelineEntries
        .map((entry) => {
          if (entry.kind === "comment") {
            const comment = entry.comment;
            return [
              '<li class="timeline-item timeline-item--comment">',
              `<p class="meta-row"><strong>👤 ${htmlEscape(commentAuthorLabel(comment.author_role))}</strong></p>`,
              `<p class="comment-body">${htmlEscape(comment.comment_text)}</p>`,
              `<p class="small">${htmlEscape(formatDetailDateTime(comment.created_at))}</p>`,
              "</li>",
            ].join("");
          }
          const event = entry.event;
          return [
            '<li class="timeline-item timeline-item--event">',
            `<p class="meta-row"><strong>⚙︎ ${htmlEscape(ticketEventSummary(event))}</strong></p>`,
            event.note_text ? `<p class="meta-row">${htmlEscape(event.note_text)}</p>` : "",
            `<p class="small">${htmlEscape(formatDetailDateTime(event.created_at))}</p>`,
            "</li>",
          ].join("");
        })
        .join(""),
      "</ul>",
    ].join("")
    : '<p class="empty-state">No timeline activity yet.</p>';
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
      reviewSectionHtml = '<section class="section"><h2>Review</h2><div class="message info">Review is not available because no staff was assigned.</div></section>';
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
        '<section class="section">',
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
        "</section>",
      ].join("");
    }
  }

  return html(
    doc(
      ticket.title,
      [
        navWithLogout({
          csrfToken: session.csrfToken,
          links: [
            { href: "/resident", label: "<- Home", className: "nav-home-pill" },
            { label: ticket.ticket_number, className: "nav-ticket-center nav-meta" },
            { label: issueTypeLabel(ticket.issue_type), className: "nav-home-pill nav-link-right" },
          ],
        }),
        '<header class="page-header">',
        ticketLifecycleProgress(ticket.status),
        `<h1 class="ticket-detail-title">${htmlEscape(ticket.title)}</h1>`,
        `<p class="ticket-detail-meta">Updated ${htmlEscape(formatDetailDateTime(ticket.updated_at))} (${htmlEscape(relativeTimeAgo(ticket.updated_at, nowMillis))})</p>`,
        "</header>",
        '<section class="section">',
        '<div class="detail-stack">',
        '<article class="resident-meta detail-block">',
        "<h3>Description</h3>",
        `<p>${htmlEscape(ticket.description)}</p>`,
        "</article>",
        "</div>",
        "</section>",
        assignedSection,
        submittedReviewHtml,
        reviewSectionHtml,
        '<section class="section">',
        "<h2>Timeline</h2>",
        eventsHtml,
        "</section>",
        '<section class="section">',
        "<h2>Add Comment</h2>",
        commentFormErrorHtml,
        commentFormHtml,
        "</section>",
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
  showLogout = false,
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
          ].filter(Boolean),
        }),
        '<header class="page-header">',
        `<h1>${htmlEscape(title)}</h1>`,
        "</header>",
        `<div class="message info">${htmlEscape(content)}</div>`,
        extraHtml,
        showLogout ? logoutPanel({ csrfToken: session.csrfToken }) : "",
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
  return { href: "/resident", label: "← Home" };
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
    return '<p class="empty-state">No timeline events yet.</p>';
  }
  return [
    '<ul class="timeline">',
    events
      .map((event) =>
        [
          '<li class="timeline-item">',
          `<p class="meta-row"><strong>${htmlEscape(ticketEventSummary(event))}</strong></p>`,
          event.note_text ? `<p class="meta-row">${htmlEscape(event.note_text)}</p>` : "",
          `<p class="small">${htmlEscape(formatDetailDateTime(event.created_at))}</p>`,
          "</li>",
        ].join(""),
      )
      .join(""),
    "</ul>",
  ].join("");
}

function renderComments(comments) {
  if (comments.length === 0) {
    return '<p class="empty-state">No comments yet.</p>';
  }
  return [
    '<ul class="comment-list">',
    comments
      .map((comment) =>
        [
          '<li class="comment-item">',
          `<p class="comment-head">${htmlEscape(commentAuthorLabel(comment.author_role))} | ${htmlEscape(formatDetailDateTime(comment.created_at))}</p>`,
          `<p class="comment-body">${htmlEscape(comment.comment_text)}</p>`,
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
      '<section class="section">',
      "<h2>Assigned Staff</h2>",
      kvGrid([
        ["Name:", ticket.assigned_staff_name],
        ["Type:", staffTypeLabel(ticket.assigned_staff_type)],
        ["Mobile:", ticket.assigned_staff_mobile_number],
      ]),
      "</section>",
    ].join("")
    : '<section class="section"><h2>Assigned Staff</h2><p class="empty-state">This ticket is currently unassigned.</p></section>';
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
        '<header class="page-header">',
        `<h1>Ticket ${htmlEscape(ticket.ticket_number)}</h1>`,
        '<p class="page-subtitle">Review details and act on the next valid workflow step.</p>',
        "</header>",
        kvGrid([
          ["Apartment:", ticket.apartment_name],
          ["Flat:", ticket.resident_flat_number],
          ["Resident:", ticket.resident_name],
          ["Issue:", issueTypeLabel(ticket.issue_type)],
          ["Status:", statusLabel(ticket.status)],
          ["Title:", ticket.title],
          ["Description:", ticket.description],
        ]),
        `<p class="meta-row">${statusChip(ticket.status)}</p>`,
        assignedSection,
        submittedReviewHtml,
        '<section class="section">',
        assignmentHtml,
        statusHtml,
        "<h2>Add Comment</h2>",
        renderCommentForm({
          session,
          ticketId: ticket.id,
          ticketStatus: ticket.status,
          values: { comment_text: formState.comment_text || "" },
          errors: formState.commentErrors || {},
          formError: formState.commentError || "",
        }),
        "</section>",
        '<section class="section">',
        "<h2>Timeline</h2>",
        renderTimeline(events),
        "</section>",
        '<section class="section">',
        "<h2>Comments</h2>",
        renderComments(comments),
        "</section>",
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
