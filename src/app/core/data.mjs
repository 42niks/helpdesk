import {
  formatTicketNumber,
  issueTypeToStaffType,
  now,
} from "./utils.mjs";

async function findAccountForLogin(db, username) {
  return db.get(
    [
      "select id, username, password_hash, role, is_active",
      "from accounts",
      "where username = ? collate nocase",
      "limit 1",
    ].join(" "),
    [username],
  );
}
async function getResidentProfile(db, accountId) {
  return db.get(
    [
      "select r.account_id, r.apartment_id, r.full_name, r.flat_number, r.mobile_number,",
      "ap.name as apartment_name, ap.code as apartment_code",
      "from residents r",
      "join apartments ap on ap.id = r.apartment_id",
      "where r.account_id = ?",
      "limit 1",
    ].join(" "),
    [accountId],
  );
}

async function getAdminProfile(db, accountId) {
  return db.get(
    [
      "select ad.account_id, ad.apartment_id, ad.display_name, ad.mobile_number,",
      "ap.name as apartment_name, ap.code as apartment_code",
      "from admins ad",
      "join apartments ap on ap.id = ad.apartment_id",
      "where ad.account_id = ?",
      "limit 1",
    ].join(" "),
    [accountId],
  );
}

async function getStaffProfile(db, accountId) {
  return db.get(
    [
      "select st.account_id, st.full_name, st.mobile_number, st.staff_type",
      "from staff st",
      "where st.account_id = ?",
      "limit 1",
    ].join(" "),
    [accountId],
  );
}

async function listStaffLinkedApartments(db, staffAccountId) {
  return db.all(
    [
      "select ap.id, ap.name, ap.code, sal.is_active",
      "from staff_apartment_links sal",
      "join apartments ap on ap.id = sal.apartment_id",
      "where sal.staff_account_id = ? and sal.is_active = 1",
      "order by ap.name asc",
    ].join(" "),
    [staffAccountId],
  );
}

async function countResidentActiveTickets(db, residentAccountId) {
  const row = await db.get(
    [
      "select count(*) as count",
      "from tickets",
      "where resident_account_id = ? and status in ('open', 'assigned', 'in_progress')",
    ].join(" "),
    [residentAccountId],
  );
  return Number(row?.count ?? 0);
}

async function countResidentTickets(db, residentAccountId) {
  const row = await db.get(
    [
      "select count(*) as count",
      "from tickets",
      "where resident_account_id = ?",
    ].join(" "),
    [residentAccountId],
  );
  return Number(row?.count ?? 0);
}

async function listResidentTickets(db, residentAccountId, { limit = 50, offset = 0 } = {}) {
  return db.all(
    [
      "select t.id, t.ticket_number, t.issue_type, t.title, t.status, t.updated_at,",
      "case",
      "  when t.status = 'completed' and not exists (select 1 from ticket_reviews tr where tr.ticket_id = t.id)",
      "  then 1",
      "  else 0",
      "end as needs_review,",
      "s.full_name as assigned_staff_name",
      "from tickets t",
      "left join staff s on s.account_id = t.assigned_staff_account_id",
      "where t.resident_account_id = ?",
      "order by datetime(t.created_at) desc, t.id desc",
      "limit ? offset ?",
    ].join(" "),
    [residentAccountId, limit, offset],
  );
}

function buildAdminQueueWhereClause(apartmentId, filters = {}) {
  const clauses = ["t.apartment_id = ?"];
  const params = [apartmentId];

  if (filters.status) {
    clauses.push("t.status = ?");
    params.push(filters.status);
  }
  if (filters.issueType) {
    clauses.push("t.issue_type = ?");
    params.push(filters.issueType);
  }
  if (filters.assignedStaff === "unassigned") {
    clauses.push("t.assigned_staff_account_id is null");
  } else if (filters.assignedStaff) {
    clauses.push("t.assigned_staff_account_id = ?");
    params.push(Number.parseInt(filters.assignedStaff, 10));
  }
  if (filters.needsReview) {
    clauses.push(
      "t.status = 'completed' and not exists (select 1 from ticket_reviews tr where tr.ticket_id = t.id)",
    );
  }

  return {
    whereSql: clauses.join(" and "),
    params,
  };
}

async function countAdminApartmentTickets(db, apartmentId, filters) {
  const { whereSql, params } = buildAdminQueueWhereClause(apartmentId, filters);
  const row = await db.get(
    [
      "select count(*) as count",
      "from tickets t",
      "where",
      whereSql,
    ].join(" "),
    params,
  );
  return Number(row?.count ?? 0);
}

async function listAdminApartmentTickets(db, apartmentId, filters, page, pageSize) {
  const { whereSql, params } = buildAdminQueueWhereClause(apartmentId, filters);
  const offset = (page - 1) * pageSize;
  return db.all(
    [
      "select t.id, t.ticket_number, t.issue_type, t.title, t.status, t.created_at, t.updated_at, t.in_progress_at,",
      "case",
      "  when t.status = 'completed' and not exists (select 1 from ticket_reviews tr where tr.ticket_id = t.id)",
      "  then 1",
      "  else 0",
      "end as needs_review,",
      "t.assigned_staff_account_id, r.flat_number as resident_flat_number, r.full_name as resident_name,",
      "s.full_name as assigned_staff_name",
      "from tickets t",
      "join residents r on r.account_id = t.resident_account_id",
      "left join staff s on s.account_id = t.assigned_staff_account_id",
      "where",
      whereSql,
      "order by datetime(t.created_at) desc, t.id desc",
      "limit ? offset ?",
    ].join(" "),
    [...params, pageSize, offset],
  );
}

async function listAdminFilterStaff(db, apartmentId) {
  return db.all(
    [
      "select st.account_id, st.full_name",
      "from staff_apartment_links sal",
      "join staff st on st.account_id = sal.staff_account_id",
      "join accounts a on a.id = st.account_id",
      "where sal.apartment_id = ? and sal.is_active = 1 and a.is_active = 1",
      "order by st.full_name asc",
    ].join(" "),
    [apartmentId],
  );
}

async function adminAgingHighlights(db, apartmentId, currentTime) {
  const nowIso = currentTime.toISOString();
  const row = await db.get(
    [
      "select",
      "sum(case when status = 'open' and assigned_staff_account_id is null and datetime(created_at) <= datetime(?, '-24 hours') then 1 else 0 end) as unassigned_older_24h,",
      "sum(case when status = 'in_progress' and datetime(coalesce(in_progress_at, updated_at, created_at)) <= datetime(?, '-72 hours') then 1 else 0 end) as in_progress_older_72h",
      "from tickets",
      "where apartment_id = ?",
    ].join(" "),
    [nowIso, nowIso, apartmentId],
  );

  return {
    unassignedOlder24h: Number(row?.unassigned_older_24h ?? 0),
    inProgressOlder72h: Number(row?.in_progress_older_72h ?? 0),
  };
}

async function adminKpiCounts(db, apartmentId) {
  const row = await db.get(
    [
      "select",
      "sum(case when status = 'open' then 1 else 0 end) as open_count,",
      "sum(case when status = 'assigned' then 1 else 0 end) as assigned_count,",
      "sum(case when status = 'in_progress' then 1 else 0 end) as in_progress_count,",
      "sum(case when status = 'completed' then 1 else 0 end) as completed_count",
      "from tickets",
      "where apartment_id = ?",
    ].join(" "),
    [apartmentId],
  );
  return {
    open: Number(row?.open_count ?? 0),
    assigned: Number(row?.assigned_count ?? 0),
    inProgress: Number(row?.in_progress_count ?? 0),
    completed: Number(row?.completed_count ?? 0),
  };
}

async function listStaffAssignedTickets(db, staffAccountId, limit = 100) {
  return db.all(
    [
      "select t.id, t.ticket_number, t.issue_type, t.title, t.status, t.updated_at,",
      "ap.name as apartment_name, r.flat_number as resident_flat_number",
      "from tickets t",
      "join apartments ap on ap.id = t.apartment_id",
      "join residents r on r.account_id = t.resident_account_id",
      "where t.assigned_staff_account_id = ? and t.status in ('assigned', 'in_progress')",
      "order by datetime(t.created_at) desc, t.id desc",
      "limit ?",
    ].join(" "),
    [staffAccountId, limit],
  );
}

function ticketDetailBaseSql() {
  return [
    "select t.id, t.ticket_number, t.issue_type, t.title, t.description, t.status,",
    "t.created_at, t.updated_at, t.assigned_at, t.in_progress_at, t.completed_at,",
    "t.completed_by_admin_cancel, t.assigned_staff_account_id, t.apartment_id,",
    "ap.name as apartment_name, ap.code as apartment_code,",
    "r.account_id as resident_account_id, r.full_name as resident_name, r.flat_number as resident_flat_number, r.mobile_number as resident_mobile_number,",
    "s.full_name as assigned_staff_name, s.staff_type as assigned_staff_type, s.mobile_number as assigned_staff_mobile_number",
    "from tickets t",
    "join apartments ap on ap.id = t.apartment_id",
    "join residents r on r.account_id = t.resident_account_id",
    "left join staff s on s.account_id = t.assigned_staff_account_id",
  ];
}

async function getResidentTicketById(db, ticketId, residentAccountId) {
  return db.get(
    [
      ...ticketDetailBaseSql(),
      "where t.id = ? and t.resident_account_id = ?",
      "limit 1",
    ].join(" "),
    [ticketId, residentAccountId],
  );
}

async function getAdminTicketById(db, ticketId, apartmentId) {
  return db.get(
    [
      ...ticketDetailBaseSql(),
      "where t.id = ? and t.apartment_id = ?",
      "limit 1",
    ].join(" "),
    [ticketId, apartmentId],
  );
}

async function getStaffTicketById(db, ticketId, staffAccountId) {
  return db.get(
    [
      ...ticketDetailBaseSql(),
      "where t.id = ? and t.assigned_staff_account_id = ?",
      "limit 1",
    ].join(" "),
    [ticketId, staffAccountId],
  );
}

async function getTicketReview(db, ticketId) {
  return db.get(
    [
      "select tr.rating, tr.review_text, tr.created_at, tr.staff_account_id, st.full_name as staff_name",
      "from ticket_reviews tr",
      "join staff st on st.account_id = tr.staff_account_id",
      "where tr.ticket_id = ?",
      "limit 1",
    ].join(" "),
    [ticketId],
  );
}

async function listAssignableStaff(db, apartmentId, issueType) {
  const expectedStaffType = issueTypeToStaffType(issueType);
  return db.all(
    [
      "select st.account_id, st.full_name, st.staff_type",
      "from staff_apartment_links sal",
      "join staff st on st.account_id = sal.staff_account_id",
      "join accounts a on a.id = st.account_id",
      "where sal.apartment_id = ? and sal.is_active = 1 and a.is_active = 1 and st.staff_type = ?",
      "order by st.full_name asc",
    ].join(" "),
    [apartmentId, expectedStaffType],
  );
}

async function loadAssigneeForAssignment(db, staffAccountId) {
  return db.get(
    [
      "select st.account_id, st.full_name, st.staff_type, a.is_active",
      "from staff st",
      "join accounts a on a.id = st.account_id",
      "where st.account_id = ?",
      "limit 1",
    ].join(" "),
    [staffAccountId],
  );
}

async function hasActiveStaffApartmentLink(db, { staffAccountId, apartmentId }) {
  const row = await db.get(
    [
      "select id",
      "from staff_apartment_links",
      "where staff_account_id = ? and apartment_id = ? and is_active = 1",
      "limit 1",
    ].join(" "),
    [staffAccountId, apartmentId],
  );
  return Boolean(row);
}

async function listApartmentLinkedStaffRatings(db, apartmentId) {
  return db.all(
    [
      "select st.account_id, st.full_name, st.staff_type, st.mobile_number,",
      "count(case when tk.apartment_id = ? and tr.rating is not null then 1 end) as rating_count,",
      "avg(case when tk.apartment_id = ? then tr.rating end) as avg_rating",
      "from staff_apartment_links sal",
      "join staff st on st.account_id = sal.staff_account_id",
      "join accounts a on a.id = st.account_id",
      "left join ticket_reviews tr on tr.staff_account_id = st.account_id",
      "left join tickets tk on tk.id = tr.ticket_id",
      "where sal.apartment_id = ? and sal.is_active = 1 and a.is_active = 1",
      "group by st.account_id, st.full_name, st.staff_type, st.mobile_number",
      "order by st.full_name asc",
    ].join(" "),
    [apartmentId, apartmentId, apartmentId],
  );
}

async function listApartmentLinkedStaffRatingsByLinkedAt(
  db,
  apartmentId,
  { limit = 5, offset = 0 } = {},
) {
  return db.all(
    [
      "select st.account_id, st.full_name, st.staff_type, st.mobile_number, sal.linked_at,",
      "count(case when tk.apartment_id = ? and tr.rating is not null then 1 end) as rating_count,",
      "avg(case when tk.apartment_id = ? then tr.rating end) as avg_rating",
      "from staff_apartment_links sal",
      "join staff st on st.account_id = sal.staff_account_id",
      "join accounts a on a.id = st.account_id",
      "left join ticket_reviews tr on tr.staff_account_id = st.account_id",
      "left join tickets tk on tk.id = tr.ticket_id",
      "where sal.apartment_id = ? and sal.is_active = 1 and a.is_active = 1",
      "group by st.account_id, st.full_name, st.staff_type, st.mobile_number, sal.linked_at",
      "order by sal.linked_at desc, st.full_name asc",
      "limit ? offset ?",
    ].join(" "),
    [apartmentId, apartmentId, apartmentId, limit, offset],
  );
}

async function countApartmentLinkedStaff(db, apartmentId) {
  const row = await db.get(
    [
      "select count(*) as total",
      "from staff_apartment_links sal",
      "join accounts a on a.id = sal.staff_account_id",
      "where sal.apartment_id = ? and sal.is_active = 1 and a.is_active = 1",
      "limit 1",
    ].join(" "),
    [apartmentId],
  );
  return Number(row?.total || 0);
}

async function listApartmentReviewTexts(db, apartmentId, { limit = 50, offset = 0 } = {}) {
  return db.all(
    [
      "select tr.ticket_id, tr.staff_account_id, st.full_name as staff_name, tr.rating, tr.review_text, tr.created_at, tk.ticket_number",
      "from ticket_reviews tr",
      "join tickets tk on tk.id = tr.ticket_id and tk.apartment_id = ?",
      "join staff st on st.account_id = tr.staff_account_id",
      "join staff_apartment_links sal on sal.staff_account_id = tr.staff_account_id and sal.apartment_id = ? and sal.is_active = 1",
      "where tr.review_text is not null and length(trim(tr.review_text)) > 0",
      "order by tr.created_at desc, tr.id desc",
      "limit ? offset ?",
    ].join(" "),
    [apartmentId, apartmentId, limit, offset],
  );
}

async function countApartmentReviewTexts(db, apartmentId) {
  const row = await db.get(
    [
      "select count(*) as total",
      "from ticket_reviews tr",
      "join tickets tk on tk.id = tr.ticket_id and tk.apartment_id = ?",
      "join staff_apartment_links sal on sal.staff_account_id = tr.staff_account_id and sal.apartment_id = ? and sal.is_active = 1",
      "where tr.review_text is not null and length(trim(tr.review_text)) > 0",
      "limit 1",
    ].join(" "),
    [apartmentId, apartmentId],
  );
  return Number(row?.total || 0);
}

async function listApartmentReviewTextsByStaff(db, apartmentId, staffAccountId, { limit = 10, offset = 0 } = {}) {
  return db.all(
    [
      "select tr.ticket_id, tr.staff_account_id, st.full_name as staff_name, tr.rating, tr.review_text, tr.created_at, tk.ticket_number",
      "from ticket_reviews tr",
      "join tickets tk on tk.id = tr.ticket_id and tk.apartment_id = ?",
      "join staff st on st.account_id = tr.staff_account_id",
      "join staff_apartment_links sal on sal.staff_account_id = tr.staff_account_id and sal.apartment_id = ? and sal.is_active = 1",
      "where tr.staff_account_id = ? and tr.review_text is not null and length(trim(tr.review_text)) > 0",
      "order by tr.created_at desc, tr.id desc",
      "limit ? offset ?",
    ].join(" "),
    [apartmentId, apartmentId, staffAccountId, limit, offset],
  );
}

async function countApartmentReviewTextsByStaff(db, apartmentId, staffAccountId) {
  const row = await db.get(
    [
      "select count(*) as total",
      "from ticket_reviews tr",
      "join tickets tk on tk.id = tr.ticket_id and tk.apartment_id = ?",
      "join staff_apartment_links sal on sal.staff_account_id = tr.staff_account_id and sal.apartment_id = ? and sal.is_active = 1",
      "where tr.staff_account_id = ? and tr.review_text is not null and length(trim(tr.review_text)) > 0",
      "limit 1",
    ].join(" "),
    [apartmentId, apartmentId, staffAccountId],
  );
  return Number(row?.total || 0);
}

async function listPlatformStaffRatingsByAccountIds(db, staffAccountIds) {
  if (staffAccountIds.length === 0) {
    return [];
  }
  const placeholders = staffAccountIds.map(() => "?").join(", ");
  return db.all(
    [
      "select st.account_id,",
      "count(case when tr.rating is not null then 1 end) as rating_count,",
      "avg(tr.rating) as avg_rating",
      "from staff st",
      "join accounts a on a.id = st.account_id",
      "left join ticket_reviews tr on tr.staff_account_id = st.account_id",
      `where a.is_active = 1 and st.account_id in (${placeholders})`,
      "group by st.account_id",
    ].join(" "),
    staffAccountIds,
  );
}

async function listTicketEvents(db, ticketId) {
  return db.all(
    [
      "select event_type, from_status, to_status, note_text, created_at",
      "from ticket_events",
      "where ticket_id = ?",
      "order by id asc",
    ].join(" "),
    [ticketId],
  );
}

async function listTicketComments(db, ticketId) {
  return db.all(
    [
      "select author_role, comment_text, created_at",
      "from ticket_comments",
      "where ticket_id = ?",
      "order by id asc",
    ].join(" "),
    [ticketId],
  );
}
async function createResidentTicket({ db, residentProfile, session, input }) {
  const createdAt = now().toISOString();
  const pendingTicketNumber = `pending-${crypto.randomUUID()}`;

  return db.transaction(async () => {
    await db.run(
      [
        "insert into tickets",
        "(ticket_number, apartment_id, resident_account_id, resident_flat_snapshot, issue_type, title, description, status,",
        "assigned_staff_account_id, created_at, updated_at, assigned_at, in_progress_at, completed_at, completed_by_admin_cancel)",
        "values (?, ?, ?, ?, ?, ?, ?, 'open', null, ?, ?, null, null, null, 0)",
      ].join(" "),
      [
        pendingTicketNumber,
        residentProfile.apartment_id,
        session.accountId,
        residentProfile.flat_number,
        input.issue_type,
        input.title,
        input.description,
        createdAt,
        createdAt,
      ],
    );

    const row = await db.get(
      "select id from tickets where ticket_number = ? limit 1",
      [pendingTicketNumber],
    );
    const ticketId = row?.id;
    if (!ticketId) {
      throw new Error("Unable to load created ticket.");
    }

    const ticketNumber = formatTicketNumber(residentProfile.apartment_code, ticketId);
    await db.run(
      "update tickets set ticket_number = ?, updated_at = ? where id = ?",
      [ticketNumber, createdAt, ticketId],
    );
    await db.run(
      [
        "insert into ticket_events",
        "(ticket_id, event_type, from_status, to_status, from_staff_account_id, to_staff_account_id, actor_account_id, actor_role, note_text, created_at)",
        "values (?, 'created', null, 'open', null, null, ?, 'resident', null, ?)",
      ].join(" "),
      [ticketId, session.accountId, createdAt],
    );
    return ticketId;
  });
}

export {
  findAccountForLogin,
  getResidentProfile,
  getAdminProfile,
  getStaffProfile,
  listStaffLinkedApartments,
  countResidentActiveTickets,
  countResidentTickets,
  listResidentTickets,
  countAdminApartmentTickets,
  listAdminApartmentTickets,
  listAdminFilterStaff,
  adminAgingHighlights,
  adminKpiCounts,
  listStaffAssignedTickets,
  getResidentTicketById,
  getAdminTicketById,
  getStaffTicketById,
  getTicketReview,
  listAssignableStaff,
  loadAssigneeForAssignment,
  hasActiveStaffApartmentLink,
  listApartmentLinkedStaffRatings,
  listApartmentLinkedStaffRatingsByLinkedAt,
  countApartmentLinkedStaff,
  listApartmentReviewTexts,
  countApartmentReviewTexts,
  listApartmentReviewTextsByStaff,
  countApartmentReviewTextsByStaff,
  listPlatformStaffRatingsByAccountIds,
  listTicketEvents,
  listTicketComments,
  createResidentTicket,
};
