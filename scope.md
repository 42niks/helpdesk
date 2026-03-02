# Apartment Helpdesk – MVP Scope 

---

## 1. Objective

Build a web-based ticketing system supporting multiple apartments with:

- Residents raising maintenance requests
- Shared support staff working across apartments
- Apartment admins managing tickets
- Apartment admins viewing apartment-specific and overall staff performance

The system must be:

- Mobile-first
- Extremely lightweight
- Fast on slow networks
- Functional without JavaScript wherever possible
- Usable on low-end devices
- Operationally simple
- Low-cost to host

No payments. No public onboarding.

---

## 2. Product Philosophy

This product prioritizes:

- Reliability over aesthetics
- Speed over animations
- Function over frameworks
- Clarity over cleverness

Design principle:

> If it can work without JavaScript, it must work without JavaScript.

JavaScript may only be used if:
- There is no reasonable server-rendered alternative
- It improves UX without breaking non-JS fallback

Target experience:
- Feels like a minimal late-90s website
- Clean typography
- Plain HTML
- Simple CSS
- No heavy frameworks
- No client-side rendering requirement

---

## 3. Non-Functional Requirements (Critical)

### 3.1 Mobile-First

- Layout designed for small screens first
- Fully usable on 320px width
- No horizontal scrolling
- Large tap targets
- Simple forms
- No hover-dependent UI

Desktop behavior:
- No desktop-specific layout.
- Content stays in a centered, mobile-width column that never exceeds the viewport (e.g. `max-width: min(480px, 100vw)`).
- Everything outside the column remains blank (no sidebars, no multi-column views).

---

### 3.2 Performance

- Server-rendered HTML
- No heavy client bundles
- No large libraries
- Minimal CSS
- No large images
- No JavaScript-driven animations

Target:
- Fast initial load even on 3G
- Minimal number of HTTP requests
- Time-to-interaction under 1–2 seconds on slow device

---

### 3.3 JavaScript Policy

Default:
- No JavaScript required for core functionality.
- JavaScript must not be used for animations.

Allowed:
- Small progressive enhancements (optional)
- Form validation enhancement (server-side remains source of truth)

Allowed without JavaScript:
- Native/default HTML and CSS behavior (including basic CSS transitions/animations) is acceptable only if core usability and readability remain intact without it.

Not allowed:
- SPA frameworks
- Client-side routing
- Heavy UI libraries
- JavaScript animation libraries or custom JavaScript animation logic

If JS fails to load, the system must still function correctly.

---

### 3.4 Reliability & Edge Case Handling

The system must handle:

- Expired session
  - Redirect to login
  - Preserve user intent where possible
- Invalid form submission
  - Clear error messages
  - Preserve user input
- Unauthorized access
  - Proper HTTP status (403)
- Accessing deleted/deactivated user
  - Clear error page
- Attempt to assign staff not linked to apartment
  - Blocked server-side
- Duplicate form submission
  - Prevent via server validation
- Direct URL manipulation
  - Enforced server-side authorization
- Stale form (ticket already completed)
  - Graceful error

All validation must exist server-side.

---

### 3.5 Security (Basic but Correct)

- Password hashing (bcrypt or equivalent)
- HTTP-only session cookies
- CSRF protection for forms
- Input validation
- Proper SQL parameterization
- No raw SQL string interpolation
- Authorization checks on every protected route

No advanced security features required beyond best practices.

---

### 3.6 Cost Control

- Free-tier hosting
- Single database
- No background jobs
- No file uploads
- No external services
- No paid APIs
- Accept downtime if limits exceeded

The system does not require high availability.

---

### 3.7 Data Integrity

- Foreign key constraints enforced
- Apartment membership validated before ticket assignment
- One review per ticket
- Soft deletion preferred over hard deletion
- Status transitions validated (no invalid jumps)

---

### 3.8 Graceful Failure

If something fails:
- Clear error page
- No stack traces exposed
- No blank pages
- Clear next action for user

---

## 4. System Model

Centralized system with:

- Multiple apartments
- Shared support staff
- Apartment-scoped residents and admins
- Aggregated staff performance across apartments

Residents are apartment-bound.
Staff may belong to multiple apartments.
Admins manage only their apartment.

Platform operations:
- Apartment/user/staff onboarding and payroll linking is done manually by the platform operator directly in the database (no UI required).

Staff visibility rules:
- Residents can view ratings and reviews only for staff currently linked to their apartment (on payroll).
- Admins can view ratings and reviews only for staff currently linked to their apartment (on payroll).
- Admins can view overall rating (no reviews) for all staff on the platform for hiring/firing consideration.

---

## 5. Functional Scope

### 5.0 Glossary (MVP)

- Platform operator: Person operating the system who performs provisioning directly in the database.
- On payroll / currently linked: Staff has an active association with an apartment (and should be visible to that apartment for ratings/reviews).
- Rating: Numeric score associated with a staff member based on resident reviews of completed tickets.
- Review: Resident-written feedback (optionally including a rating) tied to exactly one completed ticket.
- Comment: Append-only message attached to a ticket (not a review).

### 5.1 Authentication

- Username + password
- Server-side sessions
- Manual user creation (DB only)
- No public signup
- No self-service onboarding

---

### 5.2 Ticket Lifecycle

Statuses:
- Open
- Assigned
- In Progress
- Completed

Rules:
- Only admin assigns staff
- Only assigned staff updates status
- Only resident reviews completed ticket
- Only one review per ticket
- Tickets are append-only and immutable (no editing or deleting ticket history).
- Comments can be added by resident (ticket owner), staff (assigned), and admin (apartment admin).

---

### 5.3 Access Control

Residents:
- See only their tickets
- Can view apartment-specific ratings and reviews for staff currently linked to their apartment (on payroll)

Admins:
- See all tickets in their apartment
- See apartment-specific metrics
- Can view apartment-specific ratings and reviews for staff currently linked to their apartment (on payroll)
- Can view overall staff rating (no reviews) across the platform

Staff:
- See only tickets assigned to them
- Across apartments where they are members

---

## 6. Spam Protection

Since no public signup:

- Auth required for ticket creation
- Max 5 open tickets per resident
- Minimum description length
- Optional cooldown between ticket submissions
- Ability to deactivate abusive users

No CAPTCHA required.

---

## 7. Explicitly Out of Scope

- Payments
- Notifications
- Attachments
- Chat system
- Escalations
- Background processing
- Real-time updates
- Rich UI components
- Admin super panel
