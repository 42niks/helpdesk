import {
  countApartmentReviewTextsByStaff,
  listApartmentLinkedStaffRatings,
  listApartmentReviewTextsByStaff,
} from "../core/data.mjs";
import {
  doc,
  formatAverageRating,
  html,
  htmlEscape,
  navWithLogout,
  logoutPanel,
  parsePositiveInt,
  ratingLabel,
  staffTypeLabel,
} from "../core/utils.mjs";
import {
  requireResidentSession,
} from "../auth/guards.mjs";

export async function handleResidentAccountPage({ db, request, environment }) {
  const residentAuth = await requireResidentSession({ db, request, environment });
  if (residentAuth.response) {
    return residentAuth.response;
  }
  const { session, residentProfile } = residentAuth;
  return html(
    doc(
      "Profile",
      [
        navWithLogout({
          csrfToken: session.csrfToken,
          links: [{ href: "/resident", label: "← Home", className: "nav-home-pill" }],
        }),
        '<header class="page-header resident-home-header">',
        `<h1>${htmlEscape(residentProfile.apartment_name)}</h1>`,
        `<p class="page-subtitle profile-flat-subtitle">Flat ${htmlEscape(residentProfile.flat_number)}</p>`,
        "</header>",
        logoutPanel({ csrfToken: session.csrfToken }),
      ].join(""),
    ),
  );
}

export async function handleResidentStaffRatingsPage({ db, request, environment }) {
  const residentAuth = await requireResidentSession({ db, request, environment });
  if (residentAuth.response) {
    return residentAuth.response;
  }
  const { session, residentProfile } = residentAuth;
  const ratings = await listApartmentLinkedStaffRatings(db, residentProfile.apartment_id);
  const summaryRows = ratings.length
    ? [
      '<ul class="ticket-list">',
      ratings
        .map((row) =>
          [
            '<li class="ticket-item">',
            '<div class="staff-summary-head">',
            '<div class="staff-summary-left">',
            `<h3 class="staff-summary-name">${htmlEscape(row.full_name)}</h3>`,
            `<p class="staff-summary-type">${htmlEscape(staffTypeLabel(row.staff_type))}</p>`,
            "</div>",
            '<div class="staff-summary-right">',
            `<p class="staff-summary-average">${htmlEscape(formatAverageRating(row.avg_rating))}<span class="staff-summary-star"> ★</span></p>`,
            `<p class="staff-summary-count">${htmlEscape(String(row.rating_count || 0))} ratings</p>`,
            "</div>",
            "</div>",
            `<p class="meta-row"><a class="button-link button-link-full" href="/resident/staff-ratings/${row.account_id}">View Reviews</a></p>`,
            "</li>",
          ].join(""),
        )
        .join(""),
      "</ul>",
    ].join("")
    : '<p class="empty-state">No active linked staff found for this apartment.</p>';

  return html(
    doc(
      "Staff Ratings",
      [
        navWithLogout({
          csrfToken: session.csrfToken,
          links: [
            { href: "/resident", label: "← Home", className: "nav-home-pill" },
          ],
        }),
        '<header class="page-header resident-home-header">',
        "<h1>Staff Ratings</h1>",
        "</header>",
        '<section class="section">',
        summaryRows,
        "</section>",
      ].join(""),
    ),
  );
}

export async function handleResidentStaffRatingDetailPage({
  db,
  request,
  environment,
  staffAccountId,
}) {
  const residentAuth = await requireResidentSession({ db, request, environment });
  if (residentAuth.response) {
    return residentAuth.response;
  }
  const url = new URL(request.url);
  const pageSize = 10;
  const requestedPage = parsePositiveInt(url.searchParams.get("page")) || 1;
  const { session, residentProfile } = residentAuth;
  const ratings = await listApartmentLinkedStaffRatings(db, residentProfile.apartment_id);
  const staff = ratings.find((row) => row.account_id === staffAccountId);
  if (!staff) {
    return html(
      doc(
        "Staff Reviews",
        [
          navWithLogout({
            csrfToken: session.csrfToken,
            links: [
              { href: "/resident/staff-ratings", label: "← Ratings", className: "nav-home-pill" },
            ],
          }),
          '<header class="page-header resident-home-header">',
          "<h1>Staff Reviews</h1>",
          "</header>",
          '<div class="message error">This staff member is not available in your apartment ratings list.</div>',
        ].join(""),
      ),
      404,
    );
  }

  const totalReviews = await countApartmentReviewTextsByStaff(
    db,
    residentProfile.apartment_id,
    staffAccountId,
  );
  const totalPages = Math.max(1, Math.ceil(totalReviews / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const offset = (currentPage - 1) * pageSize;
  const reviews = await listApartmentReviewTextsByStaff(
    db,
    residentProfile.apartment_id,
    staffAccountId,
    { limit: pageSize, offset },
  );
  const paginationParams = new URLSearchParams();
  const prevPage = currentPage > 1 ? currentPage - 1 : null;
  const nextPage = currentPage < totalPages ? currentPage + 1 : null;
  if (prevPage) {
    paginationParams.set("page", String(prevPage));
  }
  const prevHref = prevPage
    ? `/resident/staff-ratings/${staffAccountId}?${paginationParams.toString()}`
    : "";
  paginationParams.delete("page");
  if (nextPage) {
    paginationParams.set("page", String(nextPage));
  }
  const nextHref = nextPage
    ? `/resident/staff-ratings/${staffAccountId}?${paginationParams.toString()}`
    : "";

  const [firstReview, lastReview] = [
    totalReviews === 0 ? 0 : offset + 1,
    Math.min(offset + reviews.length, totalReviews),
  ];

  const reviewRows = reviews.length
    ? [
      '<ul class="comment-list">',
      reviews
        .map((review) =>
          [
            '<li class="comment-item">',
            `<p class="comment-head">${htmlEscape(ratingLabel(review.rating))} | ${htmlEscape(review.ticket_number)} | ${htmlEscape(review.created_at)}</p>`,
            `<p class="comment-body">${htmlEscape(review.review_text)}</p>`,
            "</li>",
          ].join(""),
        )
        .join(""),
      "</ul>",
    ].join("")
    : '<p class="empty-state">No text reviews yet.</p>';

  const paginationHtml = totalReviews > 0
    ? [
      '<div class="resident-meta pagination-row">',
      `<p class="small">Showing ${firstReview}-${lastReview} of ${totalReviews} reviews</p>`,
      '<div class="pagination-actions">',
      prevPage
        ? `<a class="button-link" href="${prevHref}">← Previous</a>`
        : '<span class="button-link button-link-disabled">← Previous</span>',
      nextPage
        ? `<a class="button-link" href="${nextHref}">Next →</a>`
        : '<span class="button-link button-link-disabled">Next →</span>',
      "</div>",
      "</div>",
    ].join("")
    : "";

  return html(
    doc(
      `${staff.full_name} Reviews`,
      [
        navWithLogout({
          csrfToken: session.csrfToken,
          links: [
            { href: "/resident/staff-ratings", label: "← Ratings", className: "nav-home-pill" },
          ],
        }),
        '<header class="page-header resident-home-header">',
        `<h1>${htmlEscape(staff.full_name)}</h1>`,
        `<p class="page-subtitle">${htmlEscape(staffTypeLabel(staff.staff_type))}</p>`,
        "</header>",
        '<div class="resident-meta kv-grid">',
        `<p><strong>Ratings:</strong> ${htmlEscape(String(staff.rating_count || 0))}</p>`,
        `<p><strong>Average:</strong> ${htmlEscape(formatAverageRating(staff.avg_rating))}</p>`,
        "</div>",
        '<section class="section">',
        "<h2>Text Reviews</h2>",
        reviewRows,
        paginationHtml,
        "</section>",
      ].join(""),
    ),
  );
}
