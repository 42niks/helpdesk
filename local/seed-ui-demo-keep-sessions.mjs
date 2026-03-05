import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";

const sqlitePath = process.env.SQLITE_PATH || "local-dev-db";

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function main() {
  const db = new DatabaseSync(sqlitePath);
  db.exec("PRAGMA foreign_keys = ON");

  const nowMs = Date.now();
  const isoHoursAgo = (hoursAgo) => new Date(nowMs - (hoursAgo * 60 * 60 * 1000)).toISOString();

  const resident = db.prepare(
    [
      "select r.account_id, r.apartment_id, r.flat_number, a.code as apartment_code",
      "from residents r",
      "join apartments a on a.id = r.apartment_id",
      "order by r.account_id asc",
      "limit 1",
    ].join(" "),
  ).get();
  if (!resident) {
    throw new Error("No resident actor found. Seed baseline actors before running this script.");
  }
  const admin = db.prepare(
    [
      "select account_id",
      "from admins",
      "where apartment_id = ?",
      "order by account_id asc",
      "limit 1",
    ].join(" "),
  ).get(resident.apartment_id);
  if (!admin) {
    throw new Error("No admin actor found for the resident apartment.");
  }

  const existingElectrician = db.prepare(
    [
      "select account_id",
      "from staff",
      "where staff_type = 'electrician'",
      "order by account_id asc",
      "limit 1",
    ].join(" "),
  ).get();
  const existingPlumber = db.prepare(
    [
      "select account_id",
      "from staff",
      "where staff_type = 'plumber'",
      "order by account_id asc",
      "limit 1",
    ].join(" "),
  ).get();
  if (!existingElectrician || !existingPlumber) {
    throw new Error("Expected at least one existing electrician and plumber staff actor.");
  }

  const touchAt = new Date(nowMs).toISOString();

  const updateAccountById = db.prepare(
    [
      "update accounts",
      "set username = ?, password_hash = ?, role = 'staff', is_active = 1, updated_at = ?",
      "where id = ?",
    ].join(" "),
  );
  const updateStaffByAccount = db.prepare(
    [
      "update staff",
      "set full_name = ?, mobile_number = ?, staff_type = ?, updated_at = ?",
      "where account_id = ?",
    ].join(" "),
  );
  const insertAccount = db.prepare(
    [
      "insert into accounts",
      "(username, password_hash, role, is_active, created_at, updated_at)",
      "values (?, ?, 'staff', 1, ?, ?)",
    ].join(" "),
  );
  const insertStaff = db.prepare(
    [
      "insert into staff",
      "(account_id, full_name, mobile_number, staff_type, created_at, updated_at)",
      "values (?, ?, ?, ?, ?, ?)",
    ].join(" "),
  );
  const upsertStaff = db.prepare(
    [
      "update staff",
      "set full_name = ?, mobile_number = ?, staff_type = ?, updated_at = ?",
      "where account_id = ?",
    ].join(" "),
  );

  function renameExistingStaff({ accountId, username, fullName, staffType, mobile }) {
    updateAccountById.run(username, hashPassword(username), touchAt, accountId);
    updateStaffByAccount.run(fullName, mobile, staffType, touchAt, accountId);
    return accountId;
  }

  function ensureStaff({ username, fullName, staffType, mobile }) {
    const existingAccount = db.prepare(
      "select id from accounts where username = ? collate nocase limit 1",
    ).get(username);
    let accountId;
    if (existingAccount) {
      accountId = existingAccount.id;
      updateAccountById.run(username, hashPassword(username), touchAt, accountId);
      const updated = upsertStaff.run(fullName, mobile, staffType, touchAt, accountId).changes;
      if (!updated) {
        insertStaff.run(accountId, fullName, mobile, staffType, touchAt, touchAt);
      }
    } else {
      const result = insertAccount.run(username, hashPassword(username), touchAt, touchAt);
      accountId = Number(result.lastInsertRowid);
      insertStaff.run(accountId, fullName, mobile, staffType, touchAt, touchAt);
    }
    return accountId;
  }

  const insertLink = db.prepare(
    [
      "insert into staff_apartment_links",
      "(staff_account_id, apartment_id, is_active, linked_at, unlinked_at)",
      "values (?, ?, 1, ?, null)",
    ].join(" "),
  );

  const insertTicket = db.prepare(
    [
      "insert into tickets",
      "(ticket_number, apartment_id, resident_account_id, resident_flat_snapshot, issue_type, title, description, status,",
      "assigned_staff_account_id, created_at, updated_at, assigned_at, in_progress_at, completed_at, completed_by_admin_cancel)",
      "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ].join(" "),
  );
  const insertEvent = db.prepare(
    [
      "insert into ticket_events",
      "(ticket_id, event_type, from_status, to_status, from_staff_account_id, to_staff_account_id, actor_account_id, actor_role, note_text, created_at)",
      "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ].join(" "),
  );
  const insertComment = db.prepare(
    [
      "insert into ticket_comments",
      "(ticket_id, author_account_id, author_role, comment_text, created_at)",
      "values (?, ?, ?, ?, ?)",
    ].join(" "),
  );
  const insertReview = db.prepare(
    [
      "insert into ticket_reviews",
      "(ticket_id, resident_account_id, staff_account_id, rating, review_text, created_at)",
      "values (?, ?, ?, ?, ?, ?)",
    ].join(" "),
  );

  let ticketCounter = 1;
  const nextTicketNumber = () => `${resident.apartment_code}-${String(ticketCounter++).padStart(6, "0")}`;

  function createTicket({
    issueType,
    title,
    description,
    status,
    assignedStaffId = null,
    initialAssignedStaffId = null,
    createdHoursAgo,
    assignedHoursAgo = null,
    reassignedHoursAgo = null,
    inProgressHoursAgo = null,
    completedHoursAgo = null,
    completedByAdminCancel = 0,
    cancelReason = null,
    cancelFromStatus = null,
    comments = [],
  }) {
    const createdAt = isoHoursAgo(createdHoursAgo);
    const assignedAt = assignedHoursAgo !== null ? isoHoursAgo(assignedHoursAgo) : null;
    const reassignedAt = reassignedHoursAgo !== null ? isoHoursAgo(reassignedHoursAgo) : null;
    const inProgressAt = inProgressHoursAgo !== null ? isoHoursAgo(inProgressHoursAgo) : null;
    const completedAt = completedHoursAgo !== null ? isoHoursAgo(completedHoursAgo) : null;

    let updatedAt = createdAt;
    if (status === "assigned") {
      updatedAt = assignedAt || createdAt;
    }
    if (status === "in_progress") {
      updatedAt = inProgressAt || assignedAt || createdAt;
    }
    if (status === "completed") {
      updatedAt = completedAt || inProgressAt || assignedAt || createdAt;
    }

    const ticketResult = insertTicket.run(
      nextTicketNumber(),
      resident.apartment_id,
      resident.account_id,
      resident.flat_number,
      issueType,
      title,
      description,
      status,
      assignedStaffId,
      createdAt,
      updatedAt,
      assignedAt,
      inProgressAt,
      completedAt,
      completedByAdminCancel,
    );
    const ticketId = Number(ticketResult.lastInsertRowid);

    insertEvent.run(
      ticketId,
      "created",
      null,
      "open",
      null,
      null,
      resident.account_id,
      "resident",
      null,
      createdAt,
    );

    if (initialAssignedStaffId && assignedAt) {
      insertEvent.run(
        ticketId,
        "assigned",
        "open",
        "assigned",
        null,
        initialAssignedStaffId,
        admin.account_id,
        "admin",
        "Initial assignment created by admin.",
        assignedAt,
      );
      if (assignedStaffId && assignedStaffId !== initialAssignedStaffId && reassignedAt) {
        insertEvent.run(
          ticketId,
          "reassigned",
          "assigned",
          "assigned",
          initialAssignedStaffId,
          assignedStaffId,
          admin.account_id,
          "admin",
          "Reassigned to better match workload.",
          reassignedAt,
        );
      }
    } else if (assignedStaffId && assignedAt) {
      insertEvent.run(
        ticketId,
        "assigned",
        "open",
        "assigned",
        null,
        assignedStaffId,
        admin.account_id,
        "admin",
        "Assigned by admin.",
        assignedAt,
      );
    }

    if (inProgressAt && assignedStaffId) {
      insertEvent.run(
        ticketId,
        "status_changed",
        "assigned",
        "in_progress",
        assignedStaffId,
        assignedStaffId,
        assignedStaffId,
        "staff",
        "Work started on-site.",
        inProgressAt,
      );
    }

    if (status === "completed" && completedAt) {
      if (completedByAdminCancel) {
        const fromStatus = cancelFromStatus || (inProgressAt ? "in_progress" : assignedAt ? "assigned" : "open");
        insertEvent.run(
          ticketId,
          "admin_completed_cancel",
          fromStatus,
          "completed",
          assignedStaffId,
          assignedStaffId,
          admin.account_id,
          "admin",
          cancelReason || "Closed by admin as duplicate/invalid request.",
          completedAt,
        );
      } else if (assignedStaffId) {
        insertEvent.run(
          ticketId,
          "status_changed",
          "in_progress",
          "completed",
          assignedStaffId,
          assignedStaffId,
          assignedStaffId,
          "staff",
          "Issue resolved and site cleaned.",
          completedAt,
        );
      }
    }

    for (const comment of comments) {
      let actorAccountId = resident.account_id;
      if (comment.role === "admin") {
        actorAccountId = admin.account_id;
      } else if (comment.role === "staff") {
        actorAccountId = comment.staffAccountId || assignedStaffId || initialAssignedStaffId;
      }
      if (!actorAccountId) {
        continue;
      }
      insertComment.run(
        ticketId,
        actorAccountId,
        comment.role,
        comment.text,
        isoHoursAgo(comment.hoursAgo),
      );
    }

    return ticketId;
  }

  function addReview({ ticketId, staffAccountId, rating, reviewText, hoursAgo }) {
    insertReview.run(
      ticketId,
      resident.account_id,
      staffAccountId,
      rating,
      reviewText,
      isoHoursAgo(hoursAgo),
    );
  }

  db.exec("begin");
  try {
    db.exec("delete from ticket_reviews");
    db.exec("delete from ticket_comments");
    db.exec("delete from ticket_events");
    db.exec("delete from tickets");

    const arjunId = renameExistingStaff({
      accountId: existingElectrician.account_id,
      username: "arjun",
      fullName: "Arjun",
      staffType: "electrician",
      mobile: "7000000001",
    });
    const raviId = renameExistingStaff({
      accountId: existingPlumber.account_id,
      username: "ravi",
      fullName: "Ravi",
      staffType: "plumber",
      mobile: "7000000002",
    });
    const priyaId = ensureStaff({
      username: "priya",
      fullName: "Priya",
      staffType: "electrician",
      mobile: "7000000003",
    });
    const karthikId = ensureStaff({
      username: "karthik",
      fullName: "Karthik",
      staffType: "electrician",
      mobile: "7000000004",
    });
    const nehaId = ensureStaff({
      username: "neha",
      fullName: "Neha",
      staffType: "plumber",
      mobile: "7000000005",
    });
    const imranId = ensureStaff({
      username: "imran",
      fullName: "Imran",
      staffType: "plumber",
      mobile: "7000000006",
    });
    const ananyaId = ensureStaff({
      username: "ananya",
      fullName: "Ananya",
      staffType: "electrician",
      mobile: "7000000007",
    });
    const lakshmiId = ensureStaff({
      username: "lakshmi",
      fullName: "Lakshmi",
      staffType: "plumber",
      mobile: "7000000008",
    });

    const staffIds = [
      arjunId,
      raviId,
      priyaId,
      karthikId,
      nehaId,
      imranId,
      ananyaId,
      lakshmiId,
    ];

    db.exec("delete from staff_apartment_links");
    for (const staffAccountId of staffIds) {
      insertLink.run(staffAccountId, resident.apartment_id, touchAt);
    }

    createTicket({
      issueType: "electrical",
      title: "Main corridor lights not working",
      description: "Lights in the common corridor are fully off since yesterday evening.",
      status: "open",
      createdHoursAgo: 36,
      comments: [
        { role: "resident", text: "Please prioritize, the corridor is dark at night.", hoursAgo: 35.5 },
      ],
    });
    createTicket({
      issueType: "plumbing",
      title: "Wash basin drain blocked",
      description: "Water drains very slowly in the bathroom wash basin.",
      status: "open",
      createdHoursAgo: 5,
    });
    createTicket({
      issueType: "plumbing",
      title: "Kitchen sink leakage near trap",
      description: "There is a continuous leak under the kitchen sink trap.",
      status: "assigned",
      assignedStaffId: raviId,
      createdHoursAgo: 14,
      assignedHoursAgo: 12,
      comments: [
        { role: "resident", text: "Sharing photo on arrival, please carry sealant.", hoursAgo: 13.5 },
        { role: "admin", text: "Assigned Ravi for same-day inspection.", hoursAgo: 12 },
      ],
    });
    createTicket({
      issueType: "electrical",
      title: "Master bedroom fan stops intermittently",
      description: "Fan works for a few minutes, then stops until power reset.",
      status: "in_progress",
      assignedStaffId: arjunId,
      initialAssignedStaffId: karthikId,
      createdHoursAgo: 110,
      assignedHoursAgo: 108,
      reassignedHoursAgo: 100,
      inProgressHoursAgo: 96,
      comments: [
        { role: "admin", text: "Reassigned to Arjun due to emergency priority.", hoursAgo: 100 },
        { role: "staff", staffAccountId: arjunId, text: "Capacitor replacement in progress.", hoursAgo: 95 },
      ],
    });

    const arjunReviewTexts = [
      "Arjun fixed the issue quickly and explained the root cause clearly.",
      "Very professional visit, arrived on time and resolved everything.",
      "Good diagnosis and neat work. Fan works perfectly now.",
      "Courteous and efficient. No follow-up needed.",
      "Excellent electrical troubleshooting, issue resolved in one visit.",
      "Polite communication and clean finishing.",
      "Quick turnaround and clear explanation.",
      "Strong technical knowledge and patient support.",
      "Resolved the flickering lights completely.",
      "Great experience, highly reliable support.",
      "Handled a complex issue calmly and fixed it.",
      "Quality work and very responsive service.",
    ];
    const arjunRatings = [5, 4, 5, 4, 5, 3, 4, 5, 4, 5, 4, 5];
    for (let i = 0; i < arjunReviewTexts.length; i += 1) {
      const completedHoursAgo = 18 + (i * 6);
      const ticketId = createTicket({
        issueType: "electrical",
        title: `Electrical service request ${i + 1}`,
        description: `Electrical issue batch ${i + 1} for demonstration coverage.`,
        status: "completed",
        assignedStaffId: arjunId,
        createdHoursAgo: completedHoursAgo + 8,
        assignedHoursAgo: completedHoursAgo + 6,
        inProgressHoursAgo: completedHoursAgo + 4,
        completedHoursAgo,
        comments: i < 3
          ? [
            { role: "resident", text: "Please check all related switch points.", hoursAgo: completedHoursAgo + 7.5 },
            { role: "staff", staffAccountId: arjunId, text: "Component replaced and retested.", hoursAgo: completedHoursAgo + 3.8 },
          ]
          : [],
      });
      addReview({
        ticketId,
        staffAccountId: arjunId,
        rating: arjunRatings[i],
        reviewText: arjunReviewTexts[i],
        hoursAgo: completedHoursAgo - 0.1,
      });
    }

    const raviReviewTexts = [
      "Ravi fixed the leakage and cleaned the area well.",
      "Drain is smooth now, good plumbing support.",
      "On-time visit and neat repair.",
      "Explained the issue and replaced the damaged part quickly.",
      "Problem solved in one attempt, very satisfied.",
    ];
    const raviRatings = [5, 4, 4, 5, 3, 4];
    for (let i = 0; i < raviRatings.length; i += 1) {
      const completedHoursAgo = 24 + (i * 7);
      const ticketId = createTicket({
        issueType: "plumbing",
        title: `Plumbing service request ${i + 1}`,
        description: `Plumbing issue batch ${i + 1} for demo coverage.`,
        status: "completed",
        assignedStaffId: raviId,
        createdHoursAgo: completedHoursAgo + 7,
        assignedHoursAgo: completedHoursAgo + 5,
        inProgressHoursAgo: completedHoursAgo + 3,
        completedHoursAgo,
      });
      addReview({
        ticketId,
        staffAccountId: raviId,
        rating: raviRatings[i],
        reviewText: i < raviReviewTexts.length ? raviReviewTexts[i] : null,
        hoursAgo: completedHoursAgo - 0.2,
      });
    }

    const priyaReviewTexts = [
      "Priya handled the electrical panel issue very well.",
      "Quick and precise repair work by Priya.",
      "Great support and follow-up communication.",
    ];
    for (let i = 0; i < priyaReviewTexts.length; i += 1) {
      const completedHoursAgo = 30 + (i * 9);
      const ticketId = createTicket({
        issueType: "electrical",
        title: `Priya electrical service ${i + 1}`,
        description: "Electrical line stabilization work completed.",
        status: "completed",
        assignedStaffId: priyaId,
        createdHoursAgo: completedHoursAgo + 6,
        assignedHoursAgo: completedHoursAgo + 5,
        inProgressHoursAgo: completedHoursAgo + 2.5,
        completedHoursAgo,
      });
      addReview({
        ticketId,
        staffAccountId: priyaId,
        rating: 4 + (i % 2),
        reviewText: priyaReviewTexts[i],
        hoursAgo: completedHoursAgo - 0.15,
      });
    }

    for (let i = 0; i < 2; i += 1) {
      const completedHoursAgo = 42 + (i * 11);
      const ticketId = createTicket({
        issueType: "electrical",
        title: `Karthik electrical service ${i + 1}`,
        description: "Electrical socket stabilization completed.",
        status: "completed",
        assignedStaffId: karthikId,
        createdHoursAgo: completedHoursAgo + 6,
        assignedHoursAgo: completedHoursAgo + 5,
        inProgressHoursAgo: completedHoursAgo + 2,
        completedHoursAgo,
      });
      addReview({
        ticketId,
        staffAccountId: karthikId,
        rating: i === 0 ? 4 : 5,
        reviewText: i === 0 ? "Karthik resolved repeated tripping effectively." : null,
        hoursAgo: completedHoursAgo - 0.12,
      });
    }

    const lakshmiTicketId = createTicket({
      issueType: "plumbing",
      title: "Bathroom shower pressure inconsistency",
      description: "Water pressure fluctuates during shower use.",
      status: "completed",
      assignedStaffId: lakshmiId,
      createdHoursAgo: 34,
      assignedHoursAgo: 32,
      inProgressHoursAgo: 31,
      completedHoursAgo: 29,
    });
    addReview({
      ticketId: lakshmiTicketId,
      staffAccountId: lakshmiId,
      rating: 4,
      reviewText: "Lakshmi adjusted fittings and pressure is now stable.",
      hoursAgo: 28.8,
    });

    createTicket({
      issueType: "electrical",
      title: "Duplicate complaint entry from earlier request",
      description: "Duplicate issue entry identified and closed by admin.",
      status: "completed",
      createdHoursAgo: 72,
      completedHoursAgo: 70,
      completedByAdminCancel: 1,
      cancelFromStatus: "open",
      cancelReason: "Duplicate ticket merged into existing work order.",
      comments: [
        { role: "admin", text: "Closing duplicate and linking resident to primary ticket.", hoursAgo: 70 },
      ],
    });
    createTicket({
      issueType: "plumbing",
      title: "Low priority seepage duplicate",
      description: "Seepage ticket duplicated during earlier follow-up call.",
      status: "completed",
      assignedStaffId: nehaId,
      createdHoursAgo: 64,
      assignedHoursAgo: 62,
      completedHoursAgo: 60,
      completedByAdminCancel: 1,
      cancelFromStatus: "assigned",
      cancelReason: "Duplicate plumbing request closed after verification.",
    });
    createTicket({
      issueType: "plumbing",
      title: "In-progress work paused and closed by admin",
      description: "Issue closed after admin confirmation with vendor contract update.",
      status: "completed",
      assignedStaffId: imranId,
      createdHoursAgo: 58,
      assignedHoursAgo: 56,
      inProgressHoursAgo: 54,
      completedHoursAgo: 52,
      completedByAdminCancel: 1,
      cancelFromStatus: "in_progress",
      cancelReason: "Replaced by external vendor maintenance batch.",
      comments: [
        { role: "staff", staffAccountId: imranId, text: "Admin requested hold before closure.", hoursAgo: 53.5 },
        { role: "admin", text: "Closing with cancellation reason for audit.", hoursAgo: 52 },
      ],
    });

    createTicket({
      issueType: "electrical",
      title: "Hallway switchboard intermittent fault",
      description: "Issue resolved recently; resident can submit review from detail page.",
      status: "completed",
      assignedStaffId: ananyaId,
      createdHoursAgo: 28,
      assignedHoursAgo: 26,
      inProgressHoursAgo: 25,
      completedHoursAgo: 23,
      comments: [
        { role: "staff", staffAccountId: ananyaId, text: "Switchboard rewired and tested.", hoursAgo: 23.2 },
      ],
    });

    db.exec("commit");

    const statusSummary = db.prepare(
      "select status, count(*) as count from tickets group by status order by status",
    ).all();
    const reviewSummary = db.prepare(
      [
        "select",
        "count(*) as total_reviews,",
        "count(case when review_text is not null and length(trim(review_text)) > 0 then 1 end) as text_reviews",
        "from ticket_reviews",
      ].join(" "),
    ).get();
    const staffSummary = db.prepare(
      [
        "select st.full_name, st.staff_type, a.username,",
        "count(case when tr.rating is not null then 1 end) as rating_count,",
        "count(case when tr.review_text is not null and length(trim(tr.review_text)) > 0 then 1 end) as text_review_count",
        "from staff st",
        "join accounts a on a.id = st.account_id",
        "left join ticket_reviews tr on tr.staff_account_id = st.account_id",
        "group by st.account_id, st.full_name, st.staff_type, a.username",
        "order by st.full_name asc",
      ].join(" "),
    ).all();

    console.log(`ok: seeded UI demo dataset into ${sqlitePath}`);
    console.log("status summary:", JSON.stringify(statusSummary));
    console.log("review summary:", JSON.stringify(reviewSummary));
    console.log("staff credentials (username/password are identical):");
    for (const row of staffSummary) {
      console.log(
        `- ${row.full_name} (${row.staff_type}) -> username=${row.username}, password=${row.username}, ratings=${row.rating_count}, text_reviews=${row.text_review_count}`,
      );
    }
  } catch (error) {
    db.exec("rollback");
    throw error;
  } finally {
    db.close();
  }
}

main();
