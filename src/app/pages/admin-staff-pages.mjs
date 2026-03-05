import {
  countApartmentReviewTexts,
  listApartmentLinkedStaffRatings,
  listApartmentReviewTexts,
  listPlatformStaffRatingsByAccountIds,
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
  ratingLabel,
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
  const showPlatform = url.searchParams.get("show_platform") === "1" || url.searchParams.get("view") === "platform";
  const sortRaw = (url.searchParams.get("sort") || "name").trim().toLowerCase();
  const sort = ["name", "rating_count", "avg_rating"].includes(sortRaw) ? sortRaw : "name";
  const dirRaw = (url.searchParams.get("dir") || "").trim().toLowerCase();
  const dirDefault = sort === "name" ? "asc" : "desc";
  const dir = ["asc", "desc"].includes(dirRaw) ? dirRaw : dirDefault;
  const pageSize = 8;
  const requestedPage = parsePositiveInt(url.searchParams.get("page")) || 1;

  const [ratingsRaw, totalReviews] = await Promise.all([
    listApartmentLinkedStaffRatings(db, adminProfile.apartment_id),
    countApartmentReviewTexts(db, adminProfile.apartment_id),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalReviews / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const offset = (currentPage - 1) * pageSize;
  const reviews = await listApartmentReviewTexts(
    db,
    adminProfile.apartment_id,
    { limit: pageSize, offset },
  );
  const staffIds = ratingsRaw.map((row) => row.account_id);
  const platformRows = showPlatform
    ? await listPlatformStaffRatingsByAccountIds(db, staffIds)
    : [];
  const platformByStaff = new Map(
    platformRows.map((row) => [row.account_id, row]),
  );
  const ratings = [...ratingsRaw].sort((a, b) => {
    if (sort === "rating_count") {
      const aValue = Number(a.rating_count || 0);
      const bValue = Number(b.rating_count || 0);
      if (aValue !== bValue) {
        return dir === "asc" ? aValue - bValue : bValue - aValue;
      }
    } else if (sort === "avg_rating") {
      const aValue = Number.isFinite(Number(a.avg_rating)) ? Number(a.avg_rating) : -1;
      const bValue = Number.isFinite(Number(b.avg_rating)) ? Number(b.avg_rating) : -1;
      if (aValue !== bValue) {
        return dir === "asc" ? aValue - bValue : bValue - aValue;
      }
    } else {
      const compare = String(a.full_name || "").localeCompare(String(b.full_name || ""), "en", { sensitivity: "base" });
      if (compare !== 0) {
        return dir === "asc" ? compare : -compare;
      }
    }
    return String(a.full_name || "").localeCompare(String(b.full_name || ""), "en", { sensitivity: "base" });
  });
  const summaryRows = ratings.length
    ? [
      '<ul class="ticket-list">',
      ratings
        .map((row) =>
          [
            '<li class="ticket-item">',
            `<h3 class="staff-summary-name">${htmlEscape(row.full_name)}</h3>`,
            '<p class="detail-card-row"><strong>Type:</strong> ',
            `<span class="detail-card-value">${htmlEscape(staffTypeLabel(row.staff_type))}</span>`,
            "</p>",
            '<p class="detail-card-row"><strong>Apartment Rating Count:</strong> ',
            `<span class="detail-card-value">${htmlEscape(String(row.rating_count || 0))}</span>`,
            "</p>",
            '<p class="detail-card-row"><strong>Apartment Average Rating:</strong> ',
            `<span class="detail-card-value">${htmlEscape(formatAverageRating(row.avg_rating))}</span>`,
            "</p>",
            showPlatform
              ? [
                '<p class="detail-card-row"><strong>Platform Rating Count:</strong> ',
                `<span class="detail-card-value">${htmlEscape(String(platformByStaff.get(row.account_id)?.rating_count || 0))}</span>`,
                "</p>",
              ].join("")
              : "",
            showPlatform
              ? [
                '<p class="detail-card-row"><strong>Platform Average Rating:</strong> ',
                `<span class="detail-card-value">${htmlEscape(formatAverageRating(platformByStaff.get(row.account_id)?.avg_rating))}</span>`,
                "</p>",
              ].join("")
              : "",
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
  const buildPageHref = (page) => {
    const params = new URLSearchParams();
    if (showPlatform) {
      params.set("show_platform", "1");
    }
    params.set("sort", sort);
    params.set("dir", dir);
    params.set("page", String(page));
    return `/admin/staff?${params.toString()}`;
  };
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
            '<li class="comment-item">',
            `<p class="comment-head">${htmlEscape(review.staff_name)} (${htmlEscape(ratingLabel(review.rating))}) | ${htmlEscape(review.ticket_number)} | ${htmlEscape(review.created_at)}</p>`,
            `<p class="comment-body">${htmlEscape(review.review_text)}</p>`,
            "</li>",
          ].join(""),
        )
        .join(""),
      "</ul>",
    ].join("")
    : '<p class="empty-state">No text reviews yet.</p>';

  return html(
    doc(
      "Apartment Staff Performance",
      [
        navWithLogout({
          csrfToken: session.csrfToken,
          links: [
            { href: "/admin", label: "← Home", className: "nav-home-pill" },
          ],
        }),
        '<header class="page-header">',
        "<h1>Apartment Staff Performance</h1>",
        '<p class="page-subtitle">Track apartment and optional platform-wide staff ratings.</p>',
        "</header>",
        '<div class="resident-meta kv-grid">',
        `<p><strong>Apartment:</strong> ${htmlEscape(adminProfile.apartment_name)}</p>`,
        "</div>",
        '<section class="section">',
        "<h2>View Controls</h2>",
        '<div class="resident-meta">',
        '<form method="get" action="/admin/staff" novalidate>',
        '<label for="show_platform">',
        `<input type="checkbox" id="show_platform" name="show_platform" value="1"${showPlatform ? " checked" : ""}> Show Platform-Wide Ratings`,
        "</label>",
        '<label for="sort">Sort Staff By</label>',
        '<select id="sort" name="sort">',
        `<option value="name"${sort === "name" ? " selected" : ""}>Name</option>`,
        `<option value="rating_count"${sort === "rating_count" ? " selected" : ""}>Apartment Rating Count</option>`,
        `<option value="avg_rating"${sort === "avg_rating" ? " selected" : ""}>Apartment Average Rating</option>`,
        "</select>",
        '<label for="dir">Order</label>',
        '<select id="dir" name="dir">',
        `<option value="asc"${dir === "asc" ? " selected" : ""}>Ascending</option>`,
        `<option value="desc"${dir === "desc" ? " selected" : ""}>Descending</option>`,
        "</select>",
        '<button type="submit" class="wide-button">Apply View</button>',
        "</form>",
        "</div>",
        "</section>",
        showPlatform
          ? '<div class="message info">Platform-wide averages and counts are shown alongside apartment metrics.</div>'
          : "",
        '<section class="section">',
        "<h2>Linked Staff Summary</h2>",
        summaryRows,
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
