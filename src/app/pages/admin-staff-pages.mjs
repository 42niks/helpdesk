import {
  countApartmentReviewTexts,
  countApartmentLinkedStaff,
  listApartmentLinkedStaffRatingsByLinkedAt,
  listPlatformStaffRatingsByAccountIds,
  listApartmentReviewTexts,
  listStaffLinkedApartments,
} from "../core/data.mjs";
import {
  doc,
  formatAverageRating,
  html,
  htmlEscape,
  logoutPanel,
  navWithLogout,
  parsePositiveInt,
  staffTypeLabel,
} from "../core/utils.mjs";
import {
  requireAdminSession,
  requireStaffSession,
} from "../auth/guards.mjs";

export async function handleAdminAccountPage({ db, request, environment }) {
  const adminAuth = await requireAdminSession({ db, request, environment });
  if (adminAuth.response) {
    return adminAuth.response;
  }
  const { session, adminProfile } = adminAuth;
  return html(
    doc(
      adminProfile.apartment_name,
      [
        navWithLogout({
          csrfToken: session.csrfToken,
          links: [
            { href: "/admin", label: "← Home", className: "nav-home-pill" },
          ],
        }),
        '<header class="page-header resident-home-header">',
        `<h1>${htmlEscape(adminProfile.apartment_name)}</h1>`,
        "</header>",
        logoutPanel({ csrfToken: session.csrfToken }),
      ].join(""),
    ),
  );
}

export async function handleStaffAccountPage({ db, request, environment }) {
  const staffAuth = await requireStaffSession({ db, request, environment });
  if (staffAuth.response) {
    return staffAuth.response;
  }
  const { session, staffProfile } = staffAuth;
  const linkedApartments = await listStaffLinkedApartments(db, session.accountId);
  const apartmentsHtml = linkedApartments.length
    ? [
      '<section class="section">',
      "<h2>Linked Apartments</h2>",
      '<ul class="ticket-list">',
      linkedApartments
        .map((row) => `<li class="ticket-item"><p class="ticket-row-title">${htmlEscape(row.name)}</p></li>`)
        .join(""),
      "</ul>",
      "</section>",
    ].join("")
    : '<p class="empty-state">No active apartment links.</p>';
  return html(
    doc(
      "Staff Account",
      [
        navWithLogout({
          csrfToken: session.csrfToken,
          links: [
            { href: "/staff", label: "← Home", className: "nav-home-pill" },
          ],
        }),
        '<header class="page-header">',
        "<h1>Staff Account</h1>",
        '<p class="page-subtitle">Profile, linked apartments, and session controls.</p>',
        "</header>",
        '<section class="section">',
        "<h2>Profile Details</h2>",
        '<div class="resident-meta kv-grid">',
        `<p><strong>Name:</strong> ${htmlEscape(staffProfile.full_name)}</p>`,
        `<p><strong>Type:</strong> ${htmlEscape(staffTypeLabel(staffProfile.staff_type))}</p>`,
        `<p><strong>Mobile:</strong> ${htmlEscape(staffProfile.mobile_number)}</p>`,
        "</div>",
        "</section>",
        apartmentsHtml,
        logoutPanel({ csrfToken: session.csrfToken }),
      ].join(""),
    ),
  );
}

export async function handleAdminStaffRatingsPage({ db, request, environment }) {
  const adminAuth = await requireAdminSession({ db, request, environment });
  if (adminAuth.response) {
    return adminAuth.response;
  }
  const { session, adminProfile } = adminAuth;
  const url = new URL(request.url);
  const reviewPageSize = 8;
  const summaryStaffLimit = 3;
  const requestedPage = parsePositiveInt(url.searchParams.get("page")) || 1;

  const [ratings, totalLinkedStaff, totalReviews] = await Promise.all([
    listApartmentLinkedStaffRatingsByLinkedAt(db, adminProfile.apartment_id, {
      limit: summaryStaffLimit,
      offset: 0,
    }),
    countApartmentLinkedStaff(db, adminProfile.apartment_id),
    countApartmentReviewTexts(db, adminProfile.apartment_id),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalReviews / reviewPageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const offset = (currentPage - 1) * reviewPageSize;
  const reviews = await listApartmentReviewTexts(
    db,
    adminProfile.apartment_id,
    { limit: reviewPageSize, offset },
  );
  const summaryRows = ratings.length
    ? [
      '<ul class="ticket-list staff-performance-list">',
      ratings
        .map((row) =>
          [
            `<li class="ticket-item staff-performance-card staff-performance-card--${htmlEscape(row.staff_type)}">`,
            '<div class="staff-performance-head">',
            `<h3 class="staff-performance-name">${htmlEscape(row.full_name)}</h3>`,
            `<span class="staff-type-pill staff-type-pill--${htmlEscape(row.staff_type)}">${htmlEscape(staffTypeLabel(row.staff_type))}</span>`,
            "</div>",
            '<div class="staff-performance-metrics">',
            '<p class="staff-performance-metric">',
            '<span class="staff-performance-metric-label">Rating Count</span>',
            `<strong class="staff-performance-metric-value">${htmlEscape(String(row.rating_count || 0))}</strong>`,
            "</p>",
            '<p class="staff-performance-metric">',
            '<span class="staff-performance-metric-label">Average Rating</span>',
            `<strong class="staff-performance-metric-value">${htmlEscape(formatAverageRating(row.avg_rating))}</strong>`,
            "</p>",
            "</div>",
            "</li>",
          ].join(""),
        )
        .join(""),
      "</ul>",
    ].join("")
    : '<p class="empty-state">No active linked staff found for this apartment.</p>';
  const [firstReview, lastReview] = [
    totalReviews === 0 ? 0 : offset + 1,
    Math.min(offset + reviews.length, totalReviews),
  ];
  const buildPageHref = (page) => `/admin/staff?page=${page}`;
  const paginationHtml = totalReviews > 0
    ? [
      '<div class="resident-meta pagination-row">',
      `<p class="small">Showing ${firstReview}-${lastReview} of ${totalReviews} reviews</p>`,
      '<div class="pagination-actions">',
      currentPage > 1
        ? `<a class="button-link" href="${buildPageHref(currentPage - 1)}">← Previous</a>`
        : '<span class="button-link button-link-disabled">← Previous</span>',
      currentPage < totalPages
        ? `<a class="button-link" href="${buildPageHref(currentPage + 1)}">Next →</a>`
        : '<span class="button-link button-link-disabled">Next →</span>',
      "</div>",
      "</div>",
    ].join("")
    : "";
  const reviewRows = reviews.length
    ? [
      '<ul class="comment-list">',
      reviews
        .map((review) =>
          [
            '<li class="comment-item comment-item--linkable">',
            `<a class="comment-item-link" href="/tickets/${htmlEscape(String(review.ticket_id))}">`,
            `<p class="comment-head">${htmlEscape(review.staff_name)} | ${htmlEscape(review.ticket_number)} | ${htmlEscape(review.created_at)}</p>`,
            `<p class="comment-body">${htmlEscape(review.review_text)}</p>`,
            "</a>",
            "</li>",
          ].join(""),
        )
        .join(""),
      "</ul>",
    ].join("")
    : '<p class="empty-state">No text reviews yet.</p>';

  return html(
    doc(
      "Staff Performance",
      [
        navWithLogout({
          csrfToken: session.csrfToken,
          links: [
            { href: "/admin", label: "← Home", className: "nav-home-pill" },
          ],
        }),
        '<header class="page-header page-header-centered">',
        "<h1>Staff Performance</h1>",
        `<p class="page-subtitle">${htmlEscape(adminProfile.apartment_name)}</p>`,
        "</header>",
        '<section class="section">',
        "<h2>Staff Summary</h2>",
        summaryRows,
        totalLinkedStaff > summaryStaffLimit
          ? '<a class="button-link button-link-full" href="/admin/staff/all">View all staff</a>'
          : "",
        "</section>",
        '<section class="section">',
        "<h2>Recent Reviews</h2>",
        reviewRows,
        paginationHtml,
        "</section>",
      ].join(""),
    ),
  );
}

export async function handleAdminAllApartmentStaffPage({ db, request, environment }) {
  const adminAuth = await requireAdminSession({ db, request, environment });
  if (adminAuth.response) {
    return adminAuth.response;
  }
  const { session, adminProfile } = adminAuth;
  const url = new URL(request.url);
  const pageSize = 8;
  const showPlatform = url.searchParams.get("show_platform") === "1";
  const requestedPage = parsePositiveInt(url.searchParams.get("page")) || 1;

  const totalStaff = await countApartmentLinkedStaff(db, adminProfile.apartment_id);
  const totalPages = Math.max(1, Math.ceil(totalStaff / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const offset = (currentPage - 1) * pageSize;
  const staffRows = await listApartmentLinkedStaffRatingsByLinkedAt(
    db,
    adminProfile.apartment_id,
    { limit: pageSize, offset },
  );
  const platformRows = showPlatform
    ? await listPlatformStaffRatingsByAccountIds(db, staffRows.map((row) => row.account_id))
    : [];
  const platformByStaff = new Map(
    platformRows.map((row) => [row.account_id, row]),
  );
  const [firstRow, lastRow] = [
    totalStaff === 0 ? 0 : offset + 1,
    Math.min(offset + staffRows.length, totalStaff),
  ];
  const buildPageHref = (page) => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (showPlatform) {
      params.set("show_platform", "1");
    }
    return `/admin/staff/all?${params.toString()}`;
  };
  const paginationHtml = totalStaff > pageSize
    ? [
      '<div class="resident-meta pagination-row">',
      `<p class="small">Showing ${firstRow}-${lastRow} of ${totalStaff} staff</p>`,
      '<div class="pagination-actions">',
      currentPage > 1
        ? `<a class="button-link" href="${buildPageHref(currentPage - 1)}">← Previous</a>`
        : '<span class="button-link button-link-disabled">← Previous</span>',
      currentPage < totalPages
        ? `<a class="button-link" href="${buildPageHref(currentPage + 1)}">Next →</a>`
        : '<span class="button-link button-link-disabled">Next →</span>',
      "</div>",
      "</div>",
    ].join("")
    : "";
  const staffListHtml = staffRows.length
    ? [
      '<ul class="ticket-list staff-performance-list">',
      staffRows.map((row) =>
        [
          `<li class="ticket-item staff-performance-card staff-performance-card--${htmlEscape(row.staff_type)}">`,
          '<div class="staff-performance-head">',
          `<h3 class="staff-performance-name">${htmlEscape(row.full_name)}</h3>`,
          `<span class="staff-type-pill staff-type-pill--${htmlEscape(row.staff_type)}">${htmlEscape(staffTypeLabel(row.staff_type))}</span>`,
          "</div>",
          '<div class="staff-performance-metrics">',
          '<p class="staff-performance-metric">',
          '<span class="staff-performance-metric-label">Apartment Rating Count</span>',
          `<strong class="staff-performance-metric-value">${htmlEscape(String(row.rating_count || 0))}</strong>`,
          "</p>",
          '<p class="staff-performance-metric">',
          '<span class="staff-performance-metric-label">Apartment Average Rating</span>',
          `<strong class="staff-performance-metric-value">${htmlEscape(formatAverageRating(row.avg_rating))}</strong>`,
          "</p>",
          showPlatform
            ? [
              '<p class="staff-performance-metric">',
              '<span class="staff-performance-metric-label">Platform Rating Count</span>',
              `<strong class="staff-performance-metric-value">${htmlEscape(String(platformByStaff.get(row.account_id)?.rating_count || 0))}</strong>`,
              "</p>",
              '<p class="staff-performance-metric">',
              '<span class="staff-performance-metric-label">Platform Average Rating</span>',
              `<strong class="staff-performance-metric-value">${htmlEscape(formatAverageRating(platformByStaff.get(row.account_id)?.avg_rating))}</strong>`,
              "</p>",
            ].join("")
            : "",
          "</div>",
          "</li>",
        ].join(""))
        .join(""),
      "</ul>",
    ].join("")
    : '<p class="empty-state">No active linked staff found for this apartment.</p>';

  return html(
    doc(
      "All Apartment Staff",
      [
        navWithLogout({
          csrfToken: session.csrfToken,
          links: [
            { href: "/admin/staff", label: "← Staff Performance", className: "nav-home-pill" },
          ],
        }),
        '<header class="page-header page-header-centered">',
        "<h1>All Apartment Staff</h1>",
        "</header>",
        '<div class="message info">',
        `Apartment-specific ratings for ${htmlEscape(adminProfile.apartment_name)}.`,
        "</div>",
        '<section class="section">',
        '<div class="resident-meta">',
        '<form method="get" action="/admin/staff/all" novalidate>',
        '<label for="show_platform">',
        `<input type="checkbox" id="show_platform" name="show_platform" value="1"${showPlatform ? " checked" : ""}> Show Platform-Wide Ratings`,
        "</label>",
        '<button type="submit" class="wide-button">Apply View</button>',
        "</form>",
        "</div>",
        staffListHtml,
        paginationHtml,
        "</section>",
      ].join(""),
    ),
  );
}
