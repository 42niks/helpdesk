import {
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
      "Admin Account",
      [
        navWithLogout({
          csrfToken: session.csrfToken,
          links: [
            { href: "/admin", label: "<- Admin Home (All Tickets)" },
            { href: "/admin/staff", label: "Apartment Staff Performance" },
          ],
        }),
        '<header class="page-header">',
        "<h1>Admin Account</h1>",
        '<p class="page-subtitle">Account and session settings.</p>',
        "</header>",
        '<section class="section">',
        "<h2>Profile Details</h2>",
        '<div class="resident-meta kv-grid">',
        `<p><strong>Display Name:</strong> ${htmlEscape(adminProfile.display_name)}</p>`,
        `<p><strong>Apartment:</strong> ${htmlEscape(adminProfile.apartment_name)}</p>`,
        `<p><strong>Mobile:</strong> ${htmlEscape(adminProfile.mobile_number || "N/A")}</p>`,
        "</div>",
        "</section>",
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
            { href: "/staff", label: "<- Staff Home (Assigned Tickets)" },
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

  const [ratings, reviews] = await Promise.all([
    listApartmentLinkedStaffRatings(db, adminProfile.apartment_id),
    listApartmentReviewTexts(db, adminProfile.apartment_id),
  ]);
  const staffIds = ratings.map((row) => row.account_id);
  const platformRows = showPlatform
    ? await listPlatformStaffRatingsByAccountIds(db, staffIds)
    : [];
  const platformByStaff = new Map(
    platformRows.map((row) => [row.account_id, row]),
  );
  const summaryRows = ratings.length
    ? [
      '<ul class="ticket-list">',
      ratings
        .map((row) =>
          [
            '<li class="ticket-item">',
            `<h3>${htmlEscape(row.full_name)}</h3>`,
            `<p class="meta-row"><strong>Type:</strong> ${htmlEscape(staffTypeLabel(row.staff_type))}</p>`,
            `<p class="meta-row"><strong>Apartment Rating Count:</strong> ${htmlEscape(String(row.rating_count || 0))}</p>`,
            `<p class="meta-row"><strong>Apartment Average Rating:</strong> ${htmlEscape(formatAverageRating(row.avg_rating))}</p>`,
            showPlatform
              ? `<p class="meta-row"><strong>Platform Rating Count:</strong> ${htmlEscape(String(platformByStaff.get(row.account_id)?.rating_count || 0))}</p>`
              : "",
            showPlatform
              ? `<p class="meta-row"><strong>Platform Average Rating:</strong> ${htmlEscape(formatAverageRating(platformByStaff.get(row.account_id)?.avg_rating))}</p>`
              : "",
            "</li>",
          ].join(""),
        )
        .join(""),
      "</ul>",
    ].join("")
    : '<p class="empty-state">No active linked staff found for this apartment.</p>';
  const reviewRows = reviews.length
    ? [
      "<h2>Recent Reviews</h2>",
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
            { href: "/admin", label: "<- Admin Home (All Tickets)" },
            { href: "/admin/account", label: "Profile" },
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
        reviewRows,
        "</section>",
      ].join(""),
    ),
  );
}
