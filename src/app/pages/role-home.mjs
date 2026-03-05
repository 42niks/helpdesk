import {
  adminAgingHighlights,
  adminKpiCounts,
  countAdminApartmentTickets,
  countResidentActiveTickets,
  countResidentTickets,
  getAdminProfile,
  getResidentProfile,
  getStaffProfile,
  listAdminApartmentTickets,
  listResidentTickets,
  listStaffAssignedTickets,
  listStaffLinkedApartments,
} from "../core/data.mjs";
import {
  adminTicketListHtml,
  residentTicketListHtml,
  staffTicketListHtml,
} from "../core/views.mjs";
import {
  html,
  htmlEscape,
  now,
  pageWithLogout,
  parsePositiveInt,
  staffTypeLabel,
} from "../core/utils.mjs";
import {
  forbiddenForRole,
  requireSession,
} from "../auth/session.mjs";

export async function handleRoleHome({ db, request, requiredRole, environment }) {
  const authResult = await requireSession({ db, request, environment });
  if (authResult.response) {
    return authResult.response;
  }
  const { session } = authResult;
  if (session.role !== requiredRole) {
    return forbiddenForRole(session);
  }

  if (requiredRole === "resident") {
    const url = new URL(request.url);
    const pageSize = 8;
    const requestedPage = parsePositiveInt(url.searchParams.get("page")) || 1;
    const residentProfile = await getResidentProfile(db, session.accountId);
    if (!residentProfile) {
      return forbiddenForRole(session, "Resident profile is missing.");
    }
    const activeTicketCount = await countResidentActiveTickets(db, session.accountId);
    const totalTickets = await countResidentTickets(db, session.accountId);
    const totalPages = Math.max(1, Math.ceil(totalTickets / pageSize));
    const currentPage = Math.min(requestedPage, totalPages);
    const offset = (currentPage - 1) * pageSize;
    const tickets = await listResidentTickets(db, session.accountId, { limit: pageSize, offset });
    const prevPage = currentPage > 1 ? currentPage - 1 : null;
    const nextPage = currentPage < totalPages ? currentPage + 1 : null;
    const firstTicket = totalTickets === 0 ? 0 : offset + 1;
    const lastTicket = Math.min(offset + tickets.length, totalTickets);
    const paginationHtml = totalTickets > 0
      ? [
        '<div class="resident-meta pagination-row">',
        `<p class="small">Showing ${firstTicket}-${lastTicket} of ${totalTickets} tickets</p>`,
        '<div class="pagination-actions">',
        prevPage
          ? `<a class="button-link" href="/resident?page=${prevPage}">← Previous</a>`
          : '<span class="button-link button-link-disabled">← Previous</span>',
        nextPage
          ? `<a class="button-link" href="/resident?page=${nextPage}">Next →</a>`
          : '<span class="button-link button-link-disabled">Next →</span>',
        "</div>",
        "</div>",
      ].join("")
      : "";
    const createTicketInlineAction = activeTicketCount < 5
      ? '<div class="section-header-actions"><form method="get" action="/tickets/new" class="inline-action-form"><button type="submit" class="button-compact">Create Ticket</button></form></div>'
      : "";
    return html(
      pageWithLogout({
        title: residentProfile.flat_number,
        welcomeText: residentProfile.apartment_name,
        headerClass: "resident-home-header",
        csrfToken: session.csrfToken,
        detailsHtml: [
          '<section class="section">',
          '<div class="section-header"><h2>' +
            (activeTicketCount === 0
              ? '<span class="active-count-number">No</span> <span class="active-count-label">Active Ticket(s)</span>'
              : `<span class="active-count-number">${activeTicketCount}</span> <span class="active-count-label">Active Ticket(s)</span>`) +
            `</h2>${createTicketInlineAction}</div>`,
          residentTicketListHtml(tickets),
          paginationHtml,
          "</section>",
        ].join(""),
        links: [
          { href: "/resident/staff-ratings", label: "⭐ Ratings", className: "nav-home-pill" },
          { href: "/resident/account", label: "👤 Profile", className: "nav-link-right nav-home-pill" },
        ],
      }),
    );
  }
  if (requiredRole === "admin") {
    const adminProfile = await getAdminProfile(db, session.accountId);
    if (!adminProfile) {
      return forbiddenForRole(session, "Admin profile is missing.");
    }
    const queueUrl = new URL(request.url);
    const pageSize = 8;
    const requestedPage = parsePositiveInt(queueUrl.searchParams.get("page")) || 1;
    const queueFilters = {
      status: "",
      issueType: "",
      assignedStaff: "",
      needsReview: false,
    };
    const [kpi, aging] = await Promise.all([
      adminKpiCounts(db, adminProfile.apartment_id),
      adminAgingHighlights(db, adminProfile.apartment_id, now()),
    ]);
    const totalTickets = await countAdminApartmentTickets(db, adminProfile.apartment_id, queueFilters);
    const totalPages = Math.max(1, Math.ceil(totalTickets / pageSize));
    const currentPage = Math.min(requestedPage, totalPages);
    const offset = (currentPage - 1) * pageSize;
    const tickets = await listAdminApartmentTickets(
      db,
      adminProfile.apartment_id,
      queueFilters,
      currentPage,
      pageSize,
    );

    const queryForPage = (page) => {
      return `/admin?page=${page}`;
    };

    const [firstTicket, lastTicket] = [
      totalTickets === 0 ? 0 : offset + 1,
      Math.min(offset + tickets.length, totalTickets),
    ];
    const paginationParts = [
      '<div class="resident-meta pagination-row">',
      `<p class="small">Showing ${firstTicket}-${lastTicket} of ${totalTickets} tickets</p>`,
      '<div class="pagination-actions">',
      currentPage > 1
        ? `<a class="button-link" href="${queryForPage(currentPage - 1)}">← Previous</a>`
        : '<span class="button-link button-link-disabled">← Previous</span>',
      currentPage < totalPages
        ? `<a class="button-link" href="${queryForPage(currentPage + 1)}">Next →</a>`
        : '<span class="button-link button-link-disabled">Next →</span>',
      "</div>",
      "</div>",
    ].join("");
    const summaryHtml = [
      '<div class="ticket-summary-grid">',
      '<article class="ticket-summary-stat ticket-summary-stat--open">',
      '<p class="ticket-summary-label">Open</p>',
      `<p class="ticket-summary-value">${kpi.open}</p>`,
      "</article>",
      '<article class="ticket-summary-stat ticket-summary-stat--assigned">',
      '<p class="ticket-summary-label">Assigned</p>',
      `<p class="ticket-summary-value">${kpi.assigned}</p>`,
      "</article>",
      '<article class="ticket-summary-stat ticket-summary-stat--in-progress">',
      '<p class="ticket-summary-label">In Progress</p>',
      `<p class="ticket-summary-value">${kpi.inProgress}</p>`,
      "</article>",
      "</div>",
      '<article class="resident-meta ticket-summary-aging">',
      '<p class="ticket-summary-aging-row"><span>Unassigned tickets older than 24h</span>',
      `<strong>${aging.unassignedOlder24h}</strong></p>`,
      '<p class="ticket-summary-aging-row"><span>In-progress tickets older than 72h</span>',
      `<strong>${aging.inProgressOlder72h}</strong></p>`,
      "</article>",
    ].join("");

    return html(
      pageWithLogout({
        title: adminProfile.apartment_name,
        welcomeText: "",
        headerClass: "resident-home-header",
        csrfToken: session.csrfToken,
        detailsHtml: [
          '<section class="section">',
          '<div class="section-header"><h2>Ticket Summary</h2></div>',
          summaryHtml,
          "</section>",
          '<section class="section">',
          '<div class="section-header"><h2>Apartment Ticket Queue</h2></div>',
          paginationParts,
          adminTicketListHtml(tickets),
          paginationParts,
          "</section>",
        ].join(""),
        links: [
          { href: "/admin/staff", label: "⭐ Staff Performance", className: "nav-home-pill" },
          { href: "/admin/account", label: "👤 Profile", className: "nav-home-pill nav-link-right" },
        ],
      }),
    );
  }

  const staffProfile = await getStaffProfile(db, session.accountId);
  if (!staffProfile) {
    return forbiddenForRole(session, "Staff profile is missing.");
  }
  const linkedApartments = await listStaffLinkedApartments(db, session.accountId);
  const tickets = await listStaffAssignedTickets(db, session.accountId);
  const linkedNames = linkedApartments.map((row) => row.name).join(", ") || "No active apartment links";
  return html(
    pageWithLogout({
      title: "Staff Home (Assigned Tickets)",
      welcomeText: `Logged in as ${session.username}.`,
      csrfToken: session.csrfToken,
      links: [{ href: "/staff/account", label: "Profile" }],
      detailsHtml: [
        '<section class="section">',
        '<div class="section-header"><h2>Staff Summary</h2></div>',
        '<div class="resident-meta kv-grid">',
        `<p><strong>Name:</strong> ${htmlEscape(staffProfile.full_name)}</p>`,
        `<p><strong>Type:</strong> ${htmlEscape(staffTypeLabel(staffProfile.staff_type))}</p>`,
        `<p><strong>Mobile:</strong> ${htmlEscape(staffProfile.mobile_number)}</p>`,
        `<p><strong>Linked Apartments:</strong> ${htmlEscape(linkedNames)}</p>`,
        "</div>",
        "</section>",
        '<section class="section">',
        '<div class="section-header"><h2>Assigned Tickets</h2></div>',
        staffTicketListHtml(tickets),
        "</section>",
      ].join(""),
    }),
  );
}
