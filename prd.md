# Apartment Helpdesk - Product Requirements Document (PRD)

Version: 4.0  
Last updated: 2026-03-02  
Status: MVP requirements baseline

## 1. Executive Summary

Apartment Helpdesk is a lightweight, server-rendered ticketing system for apartment maintenance operations.

The MVP digitizes the common "notebook at security" process into a clear workflow across three primary actors:

1. Resident: raises and tracks issues.
2. Apartment admin: assigns and monitors work for one apartment.
3. Staff: executes assigned work across one or more linked apartments.

The MVP prioritizes reliability, strict access boundaries, low operational cost, and usability on low-end mobile devices with no JavaScript dependency for core flows.

## 2. Problem and Motivation

### 2.1 Current Process

Most target apartments currently use a manual process:

1. Residents write plumbing/electrical issues in a physical notebook.
2. Staff check the notebook periodically and work through open items.
3. Admins manually follow up on pending work.

### 2.2 Problems in the Current Process

1. No reliable assignment ownership.
2. Weak visibility into status and aging.
3. No auditable timeline of who changed what.
4. No structured resident feedback loop.
5. No dependable staff performance view.

### 2.3 Why This Product / Why Now

1. Apartments need a minimal digital workflow, not a heavy operations suite.
2. Managers need accountability with low training overhead.
3. Residents need predictable visibility into ticket progress.
4. Platform operator needs low-cost hosting and operational simplicity.

### 2.4 Product Motivation

The product should preserve the simplicity of the notebook model while removing ambiguity in ownership, status, and closure quality.

## 3. Goals and Non-Goals

### 3.1 MVP Goals

1. End-to-end ticket lifecycle (`Open -> Assigned -> In Progress -> Completed`).
2. Strict server-enforced role and apartment authorization boundaries.
3. Clear screen-level behavior for each actor.
4. Append-only operational history for ticket events, comments, and reviews.
5. Mobile-first experience with core workflows functional without JavaScript.
6. Low-cost, low-complexity deployment and operations.

### 3.2 MVP Non-Goals

1. Public signup or self-serve onboarding.
2. Payments or billing workflows.
3. Attachments or media uploads.
4. Real-time chat/presence/live updates.
5. Notification stack (SMS/email/push/WhatsApp).
6. Escalation/SLA automation.
7. Background workers/queues.
8. Platform operator UI.

## 4. Personas and Roles

### 4.1 Actor Definitions

1. Resident: apartment-bound account shared by a flat, used to create and track that flat's tickets.
2. Apartment admin: single apartment-scoped managerial account used to assign and monitor tickets.
3. Staff: operational worker assigned tickets; can be linked to multiple apartments.
4. Platform operator: internal role managing provisioning directly in DB (no MVP UI).

### 4.2 Role and Account Rules

1. System roles are `resident`, `admin`, and `staff`.
2. One login account maps to exactly one role.
3. A real person who is both resident and admin must maintain two separate accounts.
4. Exactly one resident account exists per `(apartment, flat_number)` pair.
5. Resident account is intentionally shared among flat occupants in MVP.
6. Exactly one admin account exists per apartment.
7. Admin account is intentionally shared among apartment managers if there are multiple managers.
8. Staff type is mandatory and restricted to `electrician` or `plumber`.

### 4.3 Tenancy Rules

1. Resident belongs to exactly one apartment.
2. Admin belongs to exactly one apartment.
3. Staff may be linked to multiple apartments via active memberships.
4. All protected reads/writes must be both role-scoped and apartment-scoped.
5. Cross-apartment access is forbidden unless explicitly allowed in this PRD.

### 4.4 High-Level Capability Summary

| Capability | Resident | Admin | Staff |
|---|---|---|---|
| Create ticket | Yes | No | No |
| View flat ticket list | Yes | No | No |
| View apartment queue | No | Yes | No |
| View self-assigned queue | No | No | Yes |
| Assign/reassign staff | No | Yes | No |
| Move ticket status forward | No | Yes (close-as-cancel flow only) | Yes (assigned only) |
| Add comment | Yes (flat-account ticket) | Yes (apartment ticket) | Yes (assigned ticket) |
| Submit review | Yes (own completed ticket, one time) | No | No |
| View apartment review text | Yes (linked staff only) | Yes (linked staff only) | No |
| View platform staff rating summary | No | Yes | No |

## 5. Scope and Assumptions

### 5.1 In Scope

1. Username/password login and session management.
2. Role-based screen routing and server-side authorization.
3. Ticket creation, assignment, status progression, and detail timeline.
4. Append-only ticket comments.
5. One resident review per completed ticket.
6. Apartment-level admin dashboard and staff performance views.
7. Platform-wide staff rating average/count for admins via toggle in staff summary (hidden by default, no cross-apartment review text).
8. Abuse controls (active-ticket cap, minimum description length, no deduplication in MVP).
9. Standard error handling screens and behaviors.

### 5.2 Assumptions

1. Manual provisioning in DB is acceptable for MVP.
2. Initial usage volume is low enough to avoid async/background processing.
3. Basic, utilitarian UI is acceptable if reliability is high.
4. Shared admin account model is acceptable to apartment operators in MVP.

### 5.3 Dependencies

1. Correct manual setup of apartments, accounts, and staff-apartment links.
2. Schema and migration discipline to enforce constraints.
3. UAT coverage for role boundaries and cross-apartment negative cases.

## 6. User Journeys

### 6.1 Resident Journey

1. Resident logs in.
2. Resident opens ticket list and checks active ticket count.
3. Resident creates new ticket with issue type, title, and description.
4. Resident tracks assignment/progress on ticket detail timeline.
5. Resident adds comments while work is active.
6. Resident submits one review after ticket is completed.

### 6.2 Admin Journey

1. Admin logs in to apartment-scoped dashboard.
2. Admin reviews open/aging queue.
3. Admin opens ticket detail and assigns eligible staff.
4. Admin monitors comments and status movement.
5. Admin reassigns if needed during `Assigned` or `In Progress`.
6. Admin can close duplicate/invalid tickets by adding cancellation comment and marking status as `Completed`.
7. Admin reviews apartment staff feedback and (optionally toggled) platform-wide rating averages.

### 6.3 Staff Journey

1. Staff logs in and sees only own assigned tickets.
2. Staff opens ticket detail and reviews resident/apartment information.
3. Staff moves status `Assigned -> In Progress` when work starts.
4. Staff adds operational comments.
5. Staff moves status `In Progress -> Completed` when done.

### 6.4 End-to-End Ticket Journey

1. Ticket starts as `Open` on resident creation.
2. Admin assigns staff, moving ticket to `Assigned`.
3. Assigned staff starts work, moving to `In Progress`.
4. Ticket reaches `Completed` either by assigned staff after work, or by admin for duplicate/invalid closure with a cancellation comment.
5. Resident optionally leaves one review with these allowed combinations only:
   - no rating and no review text
   - only rating and no review text
   - both rating and review text

## 7. Detailed Requirements (Screen-by-Screen and Behavior-by-Behavior)

### 7.1 Screen Inventory

| Screen ID | Screen Name | Route (suggested) | Actor |
|---|---|---|---|
| P-1 | Apartment Helpdesk Home + Login | `/` | Public |
| P-2 | Session Expired (on Home + Login page) | `/?reason=expired` | Public |
| R-1 | Resident Home | `/resident` | Resident |
| R-2 | Resident Create Ticket | `/tickets/new` | Resident |
| R-3 | Ticket Detail (Resident View) | `/tickets/:id` | Resident |
| R-4 | Resident Review Block (inline in Ticket Detail) | `N/A (rendered in /tickets/:id)` | Resident |
| R-5 | Resident Staff Ratings | `/resident/staff-ratings` | Resident |
| R-6 | Resident Account | `/resident/account` | Resident |
| A-1 | Admin Home | `/admin` | Admin |
| A-2 | Admin Queue Panel (inside Home) | `N/A (rendered in /admin)` | Admin |
| A-3 | Ticket Detail (Admin View) | `/tickets/:id` | Admin |
| A-4 | Admin Apartment Staff View | `/admin/staff` | Admin |
| A-5 | Platform-Wide Rating Toggle (inside Staff View) | `N/A (rendered in /admin/staff)` | Admin |
| A-6 | Admin Account | `/admin/account` | Admin |
| S-1 | Staff Home (Assigned Queue) | `/staff` | Staff |
| S-2 | Ticket Detail (Staff View) | `/tickets/:id` | Staff |
| S-3 | Staff Account | `/staff/account` | Staff |
| X-1 | Forbidden | `/403` | Any |
| X-2 | Not Found | `/404` | Any |
| X-3 | Error | `/500` | Any |

### 7.1.1 Navigation Standards (Mandatory)

1. Every page in this PRD must include visible navigation links.
2. Navigation text must explicitly name the destination page.
3. Generic labels like `Back`, `Go Back`, or `Previous` are not allowed.
4. Left-arrow labels should still name destination clearly, for example: `<- Resident Home (All Tickets)`.
5. Navigation links must be present at top of page; optional footer duplication is allowed.

### 7.1.2 Required Navigation Links by Screen

| Screen ID | Required Navigation Links (exact style guidance) |
|---|---|
| P-1 | `Go to Apartment Helpdesk Home` (`/`) |
| P-2 | `Go to Apartment Helpdesk Home + Login` (`/`) |
| R-1 | `Create Ticket` (`/tickets/new`), `Resident Staff Ratings` (`/resident/staff-ratings`), `Resident Account` (`/resident/account`) |
| R-2 | `<- Resident Home (All Tickets)` (`/resident`), `Resident Account` (`/resident/account`) |
| R-3 | `<- Resident Home (All Tickets)` (`/resident`) when viewed by resident; `<- Admin Home (All Tickets)` (`/admin`) when viewed by admin; `<- Staff Home (Assigned Tickets)` (`/staff`) when viewed by staff |
| R-4 | Same as `R-3` because this review block is inline inside `/tickets/:id` |
| R-5 | `<- Resident Home (All Tickets)` (`/resident`), `Resident Account` (`/resident/account`) |
| R-6 | `<- Resident Home (All Tickets)` (`/resident`), `Resident Staff Ratings` (`/resident/staff-ratings`) |
| A-1 | `Apartment Staff Performance` (`/admin/staff`), `Admin Account` (`/admin/account`) |
| A-2 | Same as `A-1` because queue panel is embedded in `/admin` |
| A-3 | `<- Admin Home (All Tickets)` (`/admin`), `Apartment Staff Performance` (`/admin/staff`) |
| A-4 | `<- Admin Home (All Tickets)` (`/admin`), `Admin Account` (`/admin/account`) |
| A-5 | Same as `A-4` because this toggle is embedded inside `/admin/staff` |
| A-6 | `<- Admin Home (All Tickets)` (`/admin`), `Apartment Staff Performance` (`/admin/staff`) |
| S-1 | `Staff Account` (`/staff/account`) |
| S-2 | `<- Staff Home (Assigned Tickets)` (`/staff`), `Staff Account` (`/staff/account`) |
| S-3 | `<- Staff Home (Assigned Tickets)` (`/staff`) |
| X-1 | `Go to Resident Home (All Tickets)` (`/resident`) for resident session, `Go to Admin Home (All Tickets)` (`/admin`) for admin session, `Go to Staff Home (Assigned Tickets)` (`/staff`) for staff session, `Go to Apartment Helpdesk Home + Login` (`/`) when unauthenticated |
| X-2 | Same rule as `X-1` |
| X-3 | Same rule as `X-1` plus `Retry Current Page` (same URL) |

All screen definitions in Sections 7.2-7.6 must implement the corresponding navigation links above with the exact destination-aware wording pattern.

### 7.2 Public and Shared Screens

#### 7.2.1 P-1 Apartment Helpdesk Home + Login (`/`)

Visible to:

1. Any unauthenticated user.

Shows:

1. Username field.
2. Password field.
3. Submit button.
4. Generic error area for invalid credentials.
5. Optional informational banner (logout success/session expired).
6. Navigation link: `Go to Apartment Helpdesk Home` (`/`).

User can do:

1. Submit credentials.

Behavior:

1. Resident login success -> `R-1`.
2. Admin login success -> `A-1`.
3. Staff login success -> `S-1`.
4. Inactive account login fails with generic auth error.

#### 7.2.2 P-2 Session Expired (`/?reason=expired`)

Visible to:

1. Any user with expired/invalid session attempting protected route.

Shows:

1. Same login form as P-1.
2. Message that session expired and re-login is required.
3. Navigation link: `Go to Apartment Helpdesk Home + Login` (`/`).

User can do:

1. Re-authenticate.

#### 7.2.3 Shared Ticket Route Policy (`/tickets/:id`)

Route intent:

1. One canonical ticket URL for sharing between authorized actors.
2. No actor segment in ticket route path.

Access rules:

1. Resident can open only tickets for the logged-in resident flat account, otherwise `404`.
2. Admin can open ticket only if ticket belongs to admin's apartment, otherwise `404`.
3. Staff can open ticket only if currently assigned to that ticket, otherwise `404`.
4. Other residents are expected to use the shared flat resident account in MVP.
5. Unauthenticated users are redirected to Apartment Helpdesk Home + Login page (`/`).
6. Nonexistent ticket id returns `404`.

### 7.3 Resident Screens

#### 7.3.1 R-1 Resident Home (`/resident`)

Visible to:

1. Resident only.

Resident sees:

1. Apartment name.
2. Resident full name.
3. Flat number.
4. Mobile number.
5. Ticket summary cards by status (`Open`, `Assigned`, `In Progress`, `Completed`).
6. Active ticket counter `X/5`.
7. Flat ticket list (newest first), each row showing:
   - Ticket number
   - Issue type (`electrical` or `plumbing`)
   - Title
   - Current status
   - Assigned staff name (if assigned)
   - Last updated timestamp
8. Pagination controls for ticket list.

Resident can do:

1. Open flat ticket detail (`R-3`).
2. Go to create ticket (`R-2`) if active count < 5.
3. Filter flat tickets by status.

Resident cannot do:

1. View tickets outside the logged-in flat account.
2. Assign/reassign staff.
3. Change ticket status.

#### 7.3.2 R-2 Resident Create Ticket (`/tickets/new`)

Visible to:

1. Resident only.

Resident sees:

1. Apartment name (read-only).
2. Flat number (read-only).
3. Issue type selector with exactly two values: `electrical`, `plumbing`.
4. Title input.
5. Description textarea.
6. Submit and cancel actions.

Resident can do:

1. Submit new ticket.
2. Cancel and return to list.

Validation rules:

1. Title required, length 8-120 characters.
2. Description required, minimum 10 characters.
3. Submission blocked when the flat account already has 5 active tickets.
4. No duplicate-submission prevention in MVP: repeated submit can create multiple tickets.

Success result:

1. Ticket created in `Open` status.
2. Redirect to newly created ticket detail (`R-3`).

#### 7.3.3 R-3 Resident Ticket Detail (`/tickets/:id`)

Visible to:

1. Resident flat account only.

Resident sees:

1. Ticket number, issue type, title, description.
2. Inline review block at the top, immediately below title:
   - if review exists: shows stars + review text to all authorized viewers of `/tickets/:id`
   - if review does not exist: no review section is shown
3. Current status.
4. Created/updated timestamps.
5. Assigned staff section (if assigned):
   - Staff full name
   - Staff type
   - Staff mobile number
6. Timeline of assignment and status events.
7. Comment timeline (author role + timestamp).

Resident can do:

1. Add comment while ticket is `Open`, `Assigned`, or `In Progress`.
2. Submit review inline on this page when ticket is `Completed` and review does not yet exist.

Resident cannot do:

1. Edit ticket title/description.
2. Assign/reassign staff.
3. Change status.

#### 7.3.4 R-4 Resident Review Block (inline in `/tickets/:id`)

Visible to:

1. Resident flat account can see review input controls only when ticket is `Completed` and review does not already exist.
2. Any authorized viewer of `/tickets/:id` (resident flat account, same-apartment admin, currently assigned staff) can see submitted review output.

Resident input controls:

1. Optional rating input (`1` to `5`, nullable), rendered as stars.
2. Optional review text input.
3. Submit action.

Resident can do:

1. Submit exactly one review for the ticket.

Validation rules:

1. Reject if ticket not completed.
2. Reject if resident session does not match the ticket's resident flat account.
3. Reject if review already exists.
4. Reject if review text is submitted without a rating.
5. Allowed combinations:
   - no rating and no review text
   - only rating and no review text
   - both rating and review text
6. On successful submission, review appears at top of ticket detail just below title.
7. If review is absent, page must not show an empty review placeholder.

#### 7.3.5 R-5 Resident Staff Ratings (`/resident/staff-ratings`)

Visible to:

1. Resident only.

Resident sees:

1. Only staff currently linked to resident's apartment.
2. For each visible staff:
   - Full name
   - Staff type
   - Apartment-specific average rating
   - Apartment-specific rating count
3. Apartment-scoped review list per staff:
   - Ticket number
   - Rating value (if present)
   - Review text
   - Date

Resident can do:

1. View data only.

Resident cannot do:

1. View staff from other apartments.
2. View platform-wide staff summary.

#### 7.3.6 R-6 Resident Account (`/resident/account`)

Visible to:

1. Resident only.

Resident sees:

1. Full name.
2. Username.
3. Apartment name.
4. Flat number.
5. Mobile number.
6. Account status.

Resident can do:

1. View account details only (no profile edit in MVP).

### 7.4 Admin Screens

#### 7.4.1 A-1 Admin Home (`/admin`)

Visible to:

1. Admin only.

Admin sees:

1. Apartment name.
2. Shared-account banner indicating this login can be used by multiple managers.
3. Apartment KPI cards:
   - Open ticket count
   - Assigned ticket count
   - In-progress ticket count
   - Completed ticket count (selected period)
4. Aging highlights:
   - Unassigned tickets older than 24h
   - In-progress tickets older than 72h
5. Paginated apartment ticket list on the same screen, each row showing:
   - Ticket number
   - Issue type
   - Resident flat number
   - Resident name
   - Title
   - Status
   - Assigned staff (if any)
   - Created timestamp
   - Last updated timestamp
6. Filter controls by status, issue type, and assigned staff.
7. Navigation links to staff performance pages.

Admin can do:

1. Open ticket detail (`A-3`) from the home ticket list.
2. Filter and page through apartment tickets.
3. Navigate to staff performance pages.

Admin cannot do:

1. View other apartment data.

#### 7.4.2 A-2 Admin Queue Panel (inside `/admin`)

Visible to:

1. Admin only.

Notes:

1. This is not a separate route.
2. Queue functionality is embedded in `A-1` and documented there.
3. Kept as a logical sub-screen identifier for implementation and QA mapping.

#### 7.4.3 A-3 Admin Ticket Detail (`/tickets/:id`)

Visible to:

1. Admin of same apartment as ticket.

Admin sees:

1. Ticket summary:
   - Ticket number
   - Issue type
   - Status
   - Title/description
   - Inline review block at top below title (shown only after resident submits review)
   - Lifecycle timestamps
2. Resident contact block:
   - Resident full name
   - Flat number
   - Mobile number
3. Assignment block:
   - Current assignee
   - Eligible staff list (active link in same apartment and matching issue type)
4. Timeline block:
   - Assignment events
   - Status events
   - Comment events
   - Review summary (if present)

Admin can do:

1. Assign staff when status is `Open`.
2. Reassign staff when status is `Assigned` or `In Progress`.
3. Add admin comment in non-completed states.
4. Close duplicate/invalid tickets by:
   - adding an admin comment with cancellation reason (for example, `Cancelled: duplicate ticket`)
   - then marking status as `Completed`

Admin cannot do:

1. Edit ticket title/description.
2. Submit resident review.

#### 7.4.4 A-4 Admin Apartment Staff View (`/admin/staff`)

Visible to:

1. Admin only.

Admin sees:

1. Staff currently linked to admin apartment only.
2. Tabular staff summary (one row per staff).
3. Default visible columns:
   - Full name
   - Staff type (`electrician` or `plumber`)
   - Mobile number
   - Apartment-specific average rating
   - Apartment-specific rating count
   - Completed ticket count in this apartment
4. Apartment-scoped review feed per staff:
   - Ticket number
   - Date
   - Rating (if provided)
   - Review text

Admin can do:

1. View staff performance data.
2. Toggle platform-wide rating columns on/off in the table (off by default).

Admin cannot do:

1. Modify staff type/linkage in MVP UI.
2. View review text of staff not currently linked to apartment.

#### 7.4.5 A-5 Platform-Wide Rating Toggle (inline in `/admin/staff`)

Visible to:

1. Admin only.

Admin sees:

1. A toggle control on the staff summary table in `A-4`:
   - Label: `Show Platform-Wide Ratings`
   - Default state: off (platform-wide columns hidden)
2. When toggled on, each visible staff row additionally shows:
   - Platform-wide average rating
   - Platform-wide rating count
3. Platform-wide values must be shown alongside apartment-specific values, not replacing them.
4. No cross-apartment review text is shown in this mode.
5. No resident-identifying data is shown in this mode.

Admin can do:

1. Compare apartment-specific vs platform-wide rating averages for currently linked staff.

Admin cannot do:

1. Drill into cross-apartment review text.

#### 7.4.6 A-6 Admin Account (`/admin/account`)

Visible to:

1. Admin only.

Admin sees:

1. Username.
2. Apartment name.
3. Shared-account notice.
4. Account active/inactive status.

Admin can do:

1. View account details only.

Admin cannot do:

1. Create additional admin accounts for same apartment through UI.

### 7.5 Staff Screens

#### 7.5.1 S-1 Staff Home (Assigned Queue) (`/staff`)

Visible to:

1. Staff only.

Staff sees:

1. Staff summary cards for assigned work by status.
2. Only tickets assigned to current staff account.
3. Each row includes:
   - Ticket number
   - Apartment name
   - Resident flat number
   - Issue type
   - Title
   - Status
   - Assigned timestamp
4. Filters:
   - Status
   - Apartment
5. Pagination controls.

Staff can do:

1. Open assigned ticket detail (`S-2`).
2. Filter queue.

Staff cannot do:

1. View unassigned tickets.
2. View tickets assigned to other staff.

#### 7.5.2 S-2 Staff Ticket Detail (`/tickets/:id`)

Visible to:

1. Assigned staff only.

Staff sees:

1. Ticket summary:
   - Ticket number
   - Issue type
   - Title/description
   - Inline review block at top below title (shown only after resident submits review)
   - Status
   - Timestamps
2. Apartment and resident contact block:
   - Apartment name
   - Resident full name
   - Flat number
   - Mobile number
3. Comment timeline.
4. Status transition controls for only valid next transition.

Staff can do:

1. Move `Assigned -> In Progress`.
2. Move `In Progress -> Completed`.
3. Add comment while ticket is not completed.

Staff cannot do:

1. Reassign ticket.
2. Move status backward.
3. Edit ticket content.

#### 7.5.3 S-3 Staff Account (`/staff/account`)

Visible to:

1. Staff only.

Staff sees:

1. Full name.
2. Username.
3. Mobile number.
4. Staff type (`electrician` or `plumber`).
5. Linked apartments (active links only).
6. Account status.

Staff can do:

1. View account details only.

Staff cannot do:

1. Change staff type in UI.

### 7.6 System and Error Screens

#### 7.6.1 X-1 Forbidden (`/403`)

Shown when:

1. Authenticated user attempts unauthorized action/resource.

Shows:

1. Clear forbidden message.
2. Role-aware explicit navigation link text (not generic):
   - `Go to Resident Home (All Tickets)` for resident session
   - `Go to Admin Home (All Tickets)` for admin session
   - `Go to Staff Home (Assigned Tickets)` for staff session
   - `Go to Apartment Helpdesk Home + Login` for unauthenticated session

#### 7.6.2 X-2 Not Found (`/404`)

Shown when:

1. Unknown route or missing resource.

Shows:

1. Not found message.
2. Role-aware explicit navigation link text (not generic):
   - `Go to Resident Home (All Tickets)` for resident session
   - `Go to Admin Home (All Tickets)` for admin session
   - `Go to Staff Home (Assigned Tickets)` for staff session
   - `Go to Apartment Helpdesk Home + Login` for unauthenticated session

#### 7.6.3 X-3 Generic Error (`/500`)

Shown when:

1. Unhandled server failure occurs.

Shows:

1. Safe generic error message.
2. `Retry Current Page` navigation link.
3. Role-aware explicit navigation link text (not generic):
   - `Go to Resident Home (All Tickets)` for resident session
   - `Go to Admin Home (All Tickets)` for admin session
   - `Go to Staff Home (Assigned Tickets)` for staff session
   - `Go to Apartment Helpdesk Home + Login` for unauthenticated session
4. No stack trace or internal SQL/server details.

### 7.7 Authorization Matrix (Detailed)

| Action | Resident | Admin | Staff |
|---|---|---|---|
| Login/logout | Yes | Yes | Yes |
| Create ticket | Yes (own apartment) | No | No |
| View flat ticket list | Yes | No | No |
| View apartment queue | No | Yes (own apartment only) | No |
| View self assigned queue | No | No | Yes (self only) |
| Assign/reassign staff | No | Yes (own apartment only) | No |
| Change ticket status | No | Yes (close duplicate/invalid as `Completed` with required cancellation comment) | Yes (if currently assigned) |
| Add comment | Yes (flat-account ticket) | Yes (apartment ticket) | Yes (assigned ticket) |
| Submit review | Yes (flat-account completed ticket, one only) | No | No |
| View apartment staff reviews | Yes (own apartment, linked staff only) | Yes (own apartment, linked staff only) | No |
| View platform staff rating summary | No | Yes | No |

### 7.8 Ticket Lifecycle and Transition Rules

Allowed statuses:

1. `Open`
2. `Assigned`
3. `In Progress`
4. `Completed`

Allowed transitions:

1. `Open -> Assigned` by admin.
2. `Assigned -> In Progress` by assigned staff.
3. `In Progress -> Completed` by assigned staff.
4. `Open -> Completed` by admin only for duplicate/invalid closure, with mandatory cancellation comment.
5. `Assigned -> Completed` by admin only for duplicate/invalid closure, with mandatory cancellation comment.
6. `In Progress -> Completed` by admin only for duplicate/invalid closure, with mandatory cancellation comment.

Forbidden transitions:

1. Backward transitions.
2. Skip transitions by non-admin actors.
3. Any transition by unauthorized actor.

### 7.9 Validation and Edge Cases

1. Flat-account maximum active tickets is 5 (`Open`, `Assigned`, `In Progress`).
2. Title length must be 8-120 characters.
3. Description minimum length is 10 characters.
4. Stale form submission must fail safely with refresh guidance.
5. Ticket duplicate submission is allowed in MVP; repeated submit can create multiple tickets.
6. Duplicate review submission must not create multiple reviews for the same ticket.
7. Deactivated users cannot log in or mutate data.
8. Historical records remain visible for audit after deactivation.
9. Unauthorized direct URL access returns `403`.
10. Missing resources return `404`.
11. Validation errors preserve user input where safe.

### 7.10 Staff Visibility Rules (Resolved)

1. Residents can view ratings/review text only for staff currently linked to resident's apartment.
2. Admins can view ratings/review text only for staff currently linked to admin's apartment.
3. If staff is unlinked from apartment, that apartment's review views no longer show that staff's review text.
4. Historical ticket pages continue to show factual assignment/status history.
5. Admin staff summary toggle can show platform-wide average rating and rating count for visible staff.
6. Platform summary never exposes cross-apartment review text.
7. Platform summary never exposes resident-identifying details.

### 7.11 Non-Functional and Security Requirements

1. Mobile-first layout usable at 320px width.
2. Desktop uses centered single-column mobile-style layout.
3. Core flows must work with JavaScript disabled.
4. Secure password hashing (never plaintext).
5. HTTP-only session cookies.
6. CSRF protection on state-changing forms.
7. Parameterized SQL and server-side input validation.
8. No stack traces/sensitive internals in user-visible errors.
9. Free-tier-friendly, low-cost operational footprint.

## 8. Data Model (Product-Level)

### 8.1 Common Account Fields (All Roles)

| Field | Required | Notes |
|---|---|---|
| `id` | Yes | Internal unique identifier |
| `username` | Yes | Unique across all accounts |
| `password_hash` | Yes | Secure hash only |
| `role` | Yes | `resident`, `admin`, `staff` |
| `is_active` | Yes | Inactive accounts cannot log in |
| `created_at` | Yes | Audit timestamp |
| `updated_at` | Yes | Audit timestamp |
| `last_login_at` | No | Operational tracking |

### 8.2 Resident Fields

| Field | Required | Notes |
|---|---|---|
| `full_name` | Yes | Resident name |
| `mobile_number` | Yes | Resident contact |
| `apartment_id` | Yes | Exactly one apartment |
| `flat_number` | Yes | Unit identifier |
| `is_active` | Yes | Login/action gating |

Additional resident constraints:

1. Exactly one resident account exists for each `(apartment_id, flat_number)` pair.
2. The resident account is intentionally shared by flat occupants in MVP.

### 8.3 Admin Fields

| Field | Required | Notes |
|---|---|---|
| `display_name` | Yes | Example: `Palm Meadows Admin` |
| `apartment_id` | Yes | Exactly one apartment |
| `mobile_number` | No | Optional contact |
| `is_shared_account` | Yes | Always true in MVP |

Additional admin constraints:

1. One admin account per apartment.
2. Shared account model is intentional in MVP.
3. Resident+admin same person still requires two separate accounts.

### 8.4 Staff Fields

| Field | Required | Notes |
|---|---|---|
| `full_name` | Yes | Staff name |
| `mobile_number` | Yes | Staff contact |
| `staff_type` | Yes | Enum: `electrician`, `plumber` |
| `is_active` | Yes | Inactive staff cannot be newly assigned |

### 8.5 Staff-Apartment Membership Fields

| Field | Required | Notes |
|---|---|---|
| `staff_id` | Yes | Linked staff |
| `apartment_id` | Yes | Linked apartment |
| `is_active` | Yes | Active payroll/association flag |
| `linked_at` | Yes | Audit timestamp |
| `unlinked_at` | No | Set on unlink |

### 8.6 Apartment Fields

| Field | Required | Notes |
|---|---|---|
| `apartment_id` | Yes | Unique identifier |
| `apartment_name` | Yes | Display name |
| `address_line` | No | Optional in MVP |
| `is_active` | Yes | Soft deactivation support |

### 8.7 Ticket Fields

| Field | Required | Notes |
|---|---|---|
| `ticket_id` | Yes | Unique identifier |
| `ticket_number` | Yes | Human-readable reference |
| `apartment_id` | Yes | Derived from resident account |
| `resident_id` | Yes | Ticket owner |
| `resident_flat_snapshot` | Yes | Historical consistency |
| `issue_type` | Yes | Enum: `electrical`, `plumbing` |
| `title` | Yes | Required summary |
| `description` | Yes | Required details |
| `status` | Yes | `Open`, `Assigned`, `In Progress`, `Completed` |
| `assigned_staff_id` | No | Null until assigned |
| `created_at` | Yes | Audit timestamp |
| `updated_at` | Yes | Audit timestamp |
| `assigned_at` | No | First assignment time |
| `in_progress_at` | No | Set on transition |
| `completed_at` | No | Set on transition |

### 8.8 Comment Fields

| Field | Required | Notes |
|---|---|---|
| `comment_id` | Yes | Unique identifier |
| `ticket_id` | Yes | Parent ticket |
| `author_account_id` | Yes | Author account |
| `author_role` | Yes | `resident`, `admin`, `staff` |
| `comment_text` | Yes | Append-only content |
| `created_at` | Yes | Audit timestamp |

Comments are immutable after creation.

### 8.9 Review Fields

| Field | Required | Notes |
|---|---|---|
| `review_id` | Yes | Unique identifier |
| `ticket_id` | Yes | One review per ticket |
| `resident_id` | Yes | Must match the ticket's resident flat account |
| `staff_id` | Yes | Staff on completed ticket |
| `rating` | No | Integer 1-5 |
| `review_text` | No | Optional feedback, but only allowed when rating is present |
| `created_at` | Yes | Audit timestamp |

## 9. Metrics and Success Criteria

### 9.1 Metric Definitions

1. Assignment latency: `assigned_at - created_at`.
2. Completion latency: `completed_at - created_at`.
3. Completion rate: completed tickets / created tickets.
4. Review submission rate: completed tickets with review / completed tickets.
5. Rated review rate: completed tickets with numeric rating / completed tickets.

### 9.2 Success Criteria for MVP

1. Metrics in 9.1 are computable from stored product data without manual reconciliation.
2. Zero unresolved known authorization boundary defects at release.
3. Role-specific workflows are operational without JavaScript.

## 10. Risks and Open Questions

### 10.1 Key Risks and Mitigations

1. Risk: authorization regression in multi-apartment staff model.  
   Mitigation: strict server-side checks + negative tests for cross-apartment access.
2. Risk: shared admin account reduces individual manager-level traceability.  
   Mitigation: clear shared-account policy and account-level audit trail in MVP.
3. Risk: provisioning mistakes in manual DB onboarding.  
   Mitigation: operator validation checklist and data sanity queries before activation.
4. Risk: ambiguous interpretation of performance metrics.  
   Mitigation: canonical metric formulas in Section 9.

### 10.2 Open Questions (Non-Blocking for MVP)

1. Should admin comment capability remain blocked after completion, or allow post-completion notes?
   Ans: Blocked.
2. Should ticket cooldown between resident submissions be introduced in MVP or deferred?
   Ans: Deferred.

## 11. Release Acceptance Criteria

Release readiness requires all checks below:

1. Every screen in Section 7.1 is implemented with correct role gating.
2. Screen-level "sees/can/cannot" behavior matches Sections 7.2-7.6.
3. Navigation on every page follows Section 7.1.1 and 7.1.2 (no generic `Back` labels).
4. Resident full flow works end-to-end: login, create, comment, review after completion.
5. Admin full flow works end-to-end: dashboard, queue, assignment/reassignment, staff views.
6. Staff full flow works end-to-end: assigned queue, status transitions, comments.
7. Ticket state machine and forbidden transitions in Section 7.8 are enforced server-side.
8. Validation and edge-case handling in Section 7.9 is implemented.
9. Staff visibility constraints in Section 7.10 are enforced.
10. Non-functional and security requirements in Section 7.11 are met.
11. Cross-apartment and unauthorized access attempts are blocked with correct response codes.
12. Core workflows remain functional with JavaScript disabled.

## 12. Out of Scope and Future Phases

### 12.1 Explicitly Out of Scope in MVP

1. Payments/billing.
2. Attachments/media uploads.
3. Notifications.
4. Real-time updates/chat.
5. Escalation/SLA automation.
6. Platform operator management UI.

### 12.2 Likely Post-MVP Directions

1. Notifications for assignment/status updates.
2. Attachments for richer issue reporting.
3. Escalation rules and SLA tracking.
4. Support multiple resident accounts per flat with shared-flat ticket visibility rules.
5. More granular admin accountability beyond shared account model.
6. Broader issue taxonomy beyond plumbing/electrical.

## 13. Current Implementation Baseline (As of 2026-03-02)

1. Current repository is scaffold-stage with basic routes (`/`, `/_health/`, `/_db/`) and minimal meta schema.
2. Full role models, ticket workflows, comments, reviews, and screen set defined in this PRD are not yet implemented.
3. This PRD is the product-level source of truth for upcoming implementation and technical specification updates.
