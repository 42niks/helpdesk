import {
  listApartmentLinkedStaffRatings,
  listApartmentReviewTexts,
} from "../core/data.mjs";
import {
  residentPlaceholderPage,
} from "../core/views.mjs";
import {
  doc,
  formatAverageRating,
  html,
  htmlEscape,
  navWithLogout,
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
  return residentPlaceholderPage({
    session,
    title: "Resident Account",
    backLink: { href: "/resident", label: "<- Resident Home (All Tickets)" },
    secondaryLink: { href: "/resident/staff-ratings", label: "Resident Staff Ratings" },
    content: "Resident account management is planned for a later milestone.",
    extraHtml: [
      '<div class="resident-meta">',
      `<p><strong>Name:</strong> ${htmlEscape(residentProfile.full_name)}</p>`,
      `<p><strong>Apartment:</strong> ${htmlEscape(residentProfile.apartment_name)}</p>`,
      `<p><strong>Flat:</strong> ${htmlEscape(residentProfile.flat_number)}</p>`,
      `<p><strong>Mobile:</strong> ${htmlEscape(residentProfile.mobile_number)}</p>`,
      "</div>",
    ].join(""),
  });
}

export async function handleResidentStaffRatingsPage({ db, request, environment }) {
  const residentAuth = await requireResidentSession({ db, request, environment });
  if (residentAuth.response) {
    return residentAuth.response;
  }
  const { session, residentProfile } = residentAuth;
  const [ratings, reviews] = await Promise.all([
    listApartmentLinkedStaffRatings(db, residentProfile.apartment_id),
    listApartmentReviewTexts(db, residentProfile.apartment_id),
  ]);
  const summaryRows = ratings.length
    ? [
      '<ul class="ticket-list">',
      ratings
        .map((row) =>
          [
            '<li class="ticket-item">',
            `<h3>${htmlEscape(row.full_name)}</h3>`,
            `<p class="meta-row"><strong>Type:</strong> ${htmlEscape(staffTypeLabel(row.staff_type))}</p>`,
            `<p class="meta-row"><strong>Ratings:</strong> ${htmlEscape(String(row.rating_count || 0))}</p>`,
            `<p class="meta-row"><strong>Average Rating:</strong> ${htmlEscape(formatAverageRating(row.avg_rating))}</p>`,
            "</li>",
          ].join(""),
        )
        .join(""),
      "</ul>",
    ].join("")
    : '<p class="small">No active linked staff found for this apartment.</p>';
  const reviewRows = reviews.length
    ? [
      "<h2>Recent Reviews</h2>",
      '<ul class="comment-list">',
      reviews
        .map((review) =>
          [
            '<li class="comment-item">',
            `<p class="meta-row"><strong>${htmlEscape(review.staff_name)} (${htmlEscape(ratingLabel(review.rating))})</strong></p>`,
            `<p class="meta-row">${htmlEscape(review.review_text)}</p>`,
            `<p class="small">${htmlEscape(review.ticket_number)} • ${htmlEscape(review.created_at)}</p>`,
            "</li>",
          ].join(""),
        )
        .join(""),
      "</ul>",
    ].join("")
    : '<p class="small">No text reviews yet.</p>';

  return html(
    doc(
      "Resident Staff Ratings",
      [
        navWithLogout({
          csrfToken: session.csrfToken,
          links: [
            { href: "/resident", label: "<- Resident Home (All Tickets)" },
            { href: "/resident/account", label: "Profile" },
          ],
        }),
        "<h1>Resident Staff Ratings</h1>",
        "<h2>Linked Staff Summary</h2>",
        summaryRows,
        reviewRows,
      ].join(""),
    ),
  );
}
