import {
  adminAgingHighlights,
  adminKpiCounts,
  countAdminApartmentTickets,
  countResidentActiveTickets,
  getAdminProfile,
  getResidentProfile,
  getStaffProfile,
  listAdminApartmentTickets,
  listAdminFilterStaff,
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
  parseAdminQueueFilters,
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
    const residentProfile = await getResidentProfile(db, session.accountId);
    if (!residentProfile) {
      return forbiddenForRole(session, "Resident profile is missing.");
    }
    const activeTicketCount = await countResidentActiveTickets(db, session.accountId);
    const tickets = await listResidentTickets(db, session.accountId);
    return html(
      pageWithLogout({
        title: "Resident Home (All Tickets)",
        welcomeText: `Logged in as ${session.username}.`,
        csrfToken: session.csrfToken,
        detailsHtml: [
          '<section class="section">',
          '<div class="section-header"><h2>Resident Summary</h2></div>',
          '<div class="resident-meta kv-grid">',
          `<p><strong>Apartment:</strong> ${htmlEscape(residentProfile.apartment_name)}</p>`,
          `<p><strong>Flat:</strong> ${htmlEscape(residentProfile.flat_number)}</p>`,
          `<p><strong>Resident:</strong> ${htmlEscape(residentProfile.full_name)}</p>`,
          `<p><strong>Mobile:</strong> ${htmlEscape(residentProfile.mobile_number)}</p>`,
          `<p><strong>Active Tickets:</strong> ${activeTicketCount}/5</p>`,
          "</div>",
          "</section>",
          '<section class="section">',
          '<div class="section-header"><h2>All Tickets</h2></div>',
          residentTicketListHtml(tickets),
          "</section>",
        ].join(""),
        primaryAction: activeTicketCount < 5
          ? {
            method: "get",
            href: "/tickets/new",
            label: "Create Ticket",
          }
          : null,
        primaryActionSticky: true,
        links: [
          { href: "/resident/staff-ratings", label: "Resident Staff Ratings" },
          { href: "/resident/account", label: "Profile" },
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
    const queueFilters = parseAdminQueueFilters(queueUrl);
    const [kpi, aging, filterStaff] = await Promise.all([
      adminKpiCounts(db, adminProfile.apartment_id),
      adminAgingHighlights(db, adminProfile.apartment_id, now()),
      listAdminFilterStaff(db, adminProfile.apartment_id),
    ]);
    const totalTickets = await countAdminApartmentTickets(db, adminProfile.apartment_id, queueFilters);
    const totalPages = Math.max(1, Math.ceil(totalTickets / queueFilters.pageSize));
    const currentPage = Math.min(queueFilters.page, totalPages);
    const tickets = await listAdminApartmentTickets(
      db,
      adminProfile.apartment_id,
      queueFilters,
      currentPage,
      queueFilters.pageSize,
    );

    const filterStatusOptions = [
      { value: "", label: "All statuses" },
      { value: "open", label: "Open" },
      { value: "assigned", label: "Assigned" },
      { value: "in_progress", label: "In Progress" },
      { value: "completed", label: "Completed" },
    ];
    const filterIssueTypeOptions = [
      { value: "", label: "All issue types" },
      { value: "electrical", label: "Electrical" },
      { value: "plumbing", label: "Plumbing" },
    ];
    const filterAssignedOptions = [
      { value: "", label: "All assignees" },
      { value: "unassigned", label: "Unassigned" },
      ...filterStaff.map((staff) => ({
        value: String(staff.account_id),
        label: staff.full_name,
      })),
    ];

    const filterFormHtml = [
      '<div class="resident-meta">',
      '<form method="get" action="/admin" novalidate>',
      '<label for="status">Status</label>',
      '<select id="status" name="status">',
      filterStatusOptions
        .map((option) => `<option value="${htmlEscape(option.value)}"${queueFilters.status === option.value ? " selected" : ""}>${htmlEscape(option.label)}</option>`)
        .join(""),
      "</select>",
      '<label for="issue_type">Issue Type</label>',
      '<select id="issue_type" name="issue_type">',
      filterIssueTypeOptions
        .map((option) => `<option value="${htmlEscape(option.value)}"${queueFilters.issueType === option.value ? " selected" : ""}>${htmlEscape(option.label)}</option>`)
        .join(""),
      "</select>",
      '<label for="assigned_staff">Assigned Staff</label>',
      '<select id="assigned_staff" name="assigned_staff">',
      filterAssignedOptions
        .map((option) => `<option value="${htmlEscape(option.value)}"${queueFilters.assignedStaff === option.value ? " selected" : ""}>${htmlEscape(option.label)}</option>`)
        .join(""),
      "</select>",
      '<label for="page_size">Rows Per Page</label>',
      '<select id="page_size" name="page_size">',
      [10, 20, 50]
        .map((pageSize) => `<option value="${pageSize}"${queueFilters.pageSize === pageSize ? " selected" : ""}>${pageSize}</option>`)
        .join(""),
      "</select>",
      '<button type="submit" class="wide-button">Apply Filters</button>',
      "</form>",
      "</div>",
    ].join("");

    const queryForPage = (page) => {
      const params = new URLSearchParams();
      if (queueFilters.status) {
        params.set("status", queueFilters.status);
      }
      if (queueFilters.issueType) {
        params.set("issue_type", queueFilters.issueType);
      }
      if (queueFilters.assignedStaff) {
        params.set("assigned_staff", queueFilters.assignedStaff);
      }
      params.set("page_size", String(queueFilters.pageSize));
      params.set("page", String(page));
      return `/admin?${params.toString()}`;
    };

    const paginationParts = [
      `<p class="section-note"><strong>Page ${currentPage} of ${totalPages}</strong> | ${totalTickets} matching ticket(s)</p>`,
      currentPage > 1 ? `<p class="section-note"><a href="${queryForPage(currentPage - 1)}">Previous Page</a></p>` : "",
      currentPage < totalPages ? `<p class="section-note"><a href="${queryForPage(currentPage + 1)}">Next Page</a></p>` : "",
    ].join("");

    return html(
      pageWithLogout({
        title: "Admin Home (All Tickets)",
        welcomeText: `Logged in as ${session.username}.`,
        csrfToken: session.csrfToken,
        detailsHtml: [
          '<section class="section">',
          '<div class="section-header"><h2>Apartment Summary</h2></div>',
          '<div class="resident-meta kv-grid">',
          `<p><strong>Apartment:</strong> ${htmlEscape(adminProfile.apartment_name)}</p>`,
          "<p><strong>Flat:</strong> N/A (Admin account)</p>",
          "<p><strong>Shared Account:</strong> This login may be used by multiple apartment managers.</p>",
          `<p><strong>Open:</strong> ${kpi.open}</p>`,
          `<p><strong>Assigned:</strong> ${kpi.assigned}</p>`,
          `<p><strong>In Progress:</strong> ${kpi.inProgress}</p>`,
          `<p><strong>Completed:</strong> ${kpi.completed}</p>`,
          `<p><strong>Unassigned tickets older than 24h:</strong> ${aging.unassignedOlder24h}</p>`,
          `<p><strong>In-progress tickets older than 72h:</strong> ${aging.inProgressOlder72h}</p>`,
          "</div>",
          "</section>",
          '<section class="section">',
          '<div class="section-header"><h2>Queue Filters</h2></div>',
          filterFormHtml,
          "</section>",
          '<section class="section">',
          '<div class="section-header"><h2>Apartment Ticket Queue</h2></div>',
          paginationParts,
          adminTicketListHtml(tickets),
          paginationParts,
          "</section>",
        ].join(""),
        links: [
          { href: "/admin/staff", label: "Apartment Staff Performance" },
          { href: "/admin/account", label: "Profile" },
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
