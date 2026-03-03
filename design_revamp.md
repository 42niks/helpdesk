# UI/UX Revamp Plan (Mobile-First, Text-Heavy, Low-Resource)

## 1. Goal and Constraints

This revamp keeps the app:

- Minimal and fast on low-end devices.
- Fully functional without JavaScript for core flows.
- Text-first (no image dependency).
- More intuitive through stronger hierarchy, cleaner navigation, and better action placement.

North star: **reduce cognitive load per screen while keeping all critical actions one tap away**.

---

## 2. Current Implementation Review (What to Fix)

Based on current templates/styles:

- Global style and layout are monolithic in [`src/app/core/utils.mjs:57`](/Users/nikhiltr/helpdesk/src/app/core/utils.mjs:57), with limited visual hierarchy (`Arial`, near-uniform text rhythm).
- Logout is embedded in shared nav on every page via [`navWithLogout` in `src/app/core/utils.mjs:247`](/Users/nikhiltr/helpdesk/src/app/core/utils.mjs:247), which creates unnecessary prominence on task screens.
- Home pages use dense metadata blocks and long vertical stacks in [`src/app/pages/role-home.mjs:50`](/Users/nikhiltr/helpdesk/src/app/pages/role-home.mjs:50), making scanning harder on small screens.
- Ticket list rows repeat many label/value lines in [`src/app/core/views.mjs:13`](/Users/nikhiltr/helpdesk/src/app/core/views.mjs:13), [`src/app/core/views.mjs:40`](/Users/nikhiltr/helpdesk/src/app/core/views.mjs:40), and [`src/app/core/views.mjs:75`](/Users/nikhiltr/helpdesk/src/app/core/views.mjs:75), which increases reading time.
- Detail pages mix state, timeline, comments, and forms with weak section separation in [`src/app/core/views.mjs:203`](/Users/nikhiltr/helpdesk/src/app/core/views.mjs:203).
- Account and ratings pages follow the same heavy block style and do not present a clear “settings” mental model (see [`src/app/pages/admin-staff-pages.mjs:21`](/Users/nikhiltr/helpdesk/src/app/pages/admin-staff-pages.mjs:21), [`src/app/pages/resident-pages.mjs:21`](/Users/nikhiltr/helpdesk/src/app/pages/resident-pages.mjs:21)).

---

## 3. Visual Direction

Use a **“Field Notes Ledger”** aesthetic:

- Subtle ruled-paper background (pure CSS gradient, very light).
- Strong typographic hierarchy.
- Compact cards only where grouping is necessary.
- Data shown in aligned mini-columns and indented rails.

This keeps the UI functional while adding delight without heavy assets.

---

## 4. Minimal Color Palette (Platform-Wide)

Use only these tokens:

```css
:root {
  --bg-canvas: #f3f5f7;      /* App background */
  --bg-surface: #ffffff;     /* Cards/forms/content areas */
  --text-primary: #1f2933;   /* Primary text */
  --text-muted: #52606d;     /* Secondary text/meta */
  --border-subtle: #d9e2ec;  /* Dividers, card outlines */
  --accent: #0b7285;         /* Primary action, links, focus */
  --accent-soft: #e6f4f7;    /* Soft accent backgrounds */
  --danger: #b42318;         /* Errors, destructive actions */
  --success: #1f7a43;        /* Completed/success states */
}
```

Status mapping:

- `open`: muted border + text-primary
- `assigned`: accent-soft background + accent text
- `in_progress`: accent background + white text (chip only)
- `completed`: soft green background + success text

---

## 5. Typography System (Mobile-First)

Do not load web fonts. Use local stacks only.

```css
:root {
  --font-ui: "Trebuchet MS", "Verdana", "Segoe UI", sans-serif;
  --font-title: "Georgia", "Times New Roman", serif;
  --font-data: "Consolas", "Menlo", monospace;
}
```

Type scale:

- Display title (`h1`): `1.375rem` (22px), `font-family: var(--font-title)`, `font-weight: 700`, tight line-height.
- Section title (`h2`): `1.0625rem` (17px), semibold.
- Subsection title (`h3`): `0.9375rem` (15px), semibold.
- Body: `0.9375rem` (15px), regular.
- Dense body/meta: `0.8125rem` (13px), muted.
- Caption/timestamp: `0.75rem` (12px), muted.
- Ticket number + IDs: `0.8125rem` (13px), `font-family: var(--font-data)`.

Rules:

- Keep body at 15px for readability on low-end displays.
- Use 13px for metadata and labels to create hierarchy.
- Keep line-length around 32-40 characters in key dense sections.

---

## 6. Layout, Columns, and Indentation

### 6.1 Global Layout

- Mobile baseline width: 320px.
- Main container max width: 560px.
- Horizontal padding: 14px (mobile), 18px (>=480px).
- Vertical rhythm: 4px base grid (`4/8/12/16/20/24`).

### 6.2 Information Columns

Replace repeated `<p><strong>Label:</strong> Value</p>` blocks with a semantic key-value layout:

- `dl.kv-grid`
- Column layout: `grid-template-columns: 7.25rem 1fr; gap: 4px 10px;`
- At `<360px`: collapse to one column.

### 6.3 Indentation Patterns

- Ticket list row:
  - Row 1: ticket number + status chip.
  - Row 2 (indented): title.
  - Row 3 (indented): compact meta line (`Issue • Assigned Staff • Updated`).
- Timeline:
  - Left vertical border rail.
  - Each event indented 12px from rail.
- Comments:
  - Author + time in compact header row.
  - Comment body indented under header.

---

## 7. Navigation and Action Placement (Critical IA Change)

### 7.1 Global Rules

- Remove logout from shared nav everywhere.
- Keep top nav focused on task navigation only.
- Put logout only in profile/account screens under a clear “Session” section.
- Keep one primary action per screen.

### 7.2 Route-Level Placement

- `/resident`, `/admin`, `/staff`
  - Show role home heading, summary, primary queue/content.
  - Secondary links only (`Profile`, role-specific page).
  - No logout button.
- `/tickets/new`
  - Primary: `Create Ticket`
  - Secondary: explicit return link to role home.
  - No logout button.
- `/tickets/:id`
  - Show only actions relevant to current role and ticket state.
  - No logout button.
- `/resident/staff-ratings`, `/admin/staff`
  - Content + filter/toggle only.
  - No logout button.
- `/resident/account`, `/admin/account`, `/staff/account`
  - Add `Session` section with `Logout` button.
  - Keep it visually separated as lower-priority destructive action.

---

## 8. Screen-by-Screen Revamp Blueprint

### 8.1 Login (`/`)

- Keep single-column form.
- Add concise value proposition line.
- Keep only one primary CTA.
- Improve focus states and error block contrast.

### 8.2 Role Home Screens (`/resident`, `/admin`, `/staff`)

- Top: page title + muted “Logged in as …”.
- Summary strip: compact 2-column key metrics.
- Main list directly below summary.
- Primary action sticky at bottom only on screens with create flow (`/resident`: Create Ticket).

### 8.3 Ticket Lists

- Reduce per-ticket fields shown by default.
- Prioritize: ticket number, title, status, last updated, assignment summary.
- Move secondary fields (flat/resident for admin) into compressed meta line.
- Keep row tap target large and clear.

### 8.4 Ticket Detail (`/tickets/:id`)

- Order:
  1. Ticket identity + status
  2. Key details (issue/title/description)
  3. Assigned staff
  4. Actions (assign/status/review/comment form based on role/state)
  5. Timeline
  6. Comments history
- Keep forms under clear section titles and with concise helper text.
- Ensure only valid next actions are visually prominent.

### 8.5 Ratings Pages

- Keep summary as compact rows (name/type/rating count/avg).
- Show review feed as lightweight timeline-style list.
- Put platform toggle in an inline “View controls” section (admin only).

### 8.6 Account Pages

- Organize into:
  - `Profile details`
  - `Apartment links` (staff only)
  - `Session` (contains logout only)
- Logout style:
  - Secondary/destructive styling, not primary black CTA.

---

## 9. Component and Style Specs for Engineer

Create/rework shared primitives:

1. `app-shell` (page padding, background pattern, max-width)
2. `top-nav` (link-only nav)
3. `page-header` (`h1` + subtitle)
4. `kv-grid` (`dl` label/value grid)
5. `status-chip` (state colors)
6. `list-row` (ticket/comment/timeline row variants)
7. `form-section` (label/input/help/error rhythm)
8. `session-panel` (logout section in account pages)

Interaction specs:

- Min tap target: 44px height.
- Focus ring: 2px `--accent` outline with 2px offset.
- Error fields: border `--danger`, error text 13px.

---

## 10. Performance and Reliability Budget

- No external font or image requests.
- Keep total inline CSS under ~14KB uncompressed.
- No client-side framework required.
- Avoid heavy shadows/filters/animations.
- Keep DOM shallow in list rows (prefer concise markup).

Optional lightweight delight:

- One subtle page-load fade (`150ms`, opacity only) gated by `prefers-reduced-motion`.

---

## 11. Implementation Plan (File-by-File)

### Phase 1: Design Tokens + Shell

- Update [`src/app/core/utils.mjs:57`](/Users/nikhiltr/helpdesk/src/app/core/utils.mjs:57)
  - Replace current CSS block with tokenized system above.
  - Introduce new utility classes (`app-shell`, `kv-grid`, `status-chip`, `session-panel`, etc.).

### Phase 2: Navigation Refactor (Logout Relocation)

- Replace shared `navWithLogout` pattern from [`src/app/core/utils.mjs:247`](/Users/nikhiltr/helpdesk/src/app/core/utils.mjs:247) with:
  - `navLinksOnly({ links })`
  - `logoutPanel({ csrfToken })` for account pages only.
- Update usage in:
  - [`src/app/pages/role-home.mjs`](/Users/nikhiltr/helpdesk/src/app/pages/role-home.mjs)
  - [`src/app/core/views.mjs`](/Users/nikhiltr/helpdesk/src/app/core/views.mjs)
  - [`src/app/pages/resident-pages.mjs`](/Users/nikhiltr/helpdesk/src/app/pages/resident-pages.mjs)
  - [`src/app/pages/admin-staff-pages.mjs`](/Users/nikhiltr/helpdesk/src/app/pages/admin-staff-pages.mjs)

### Phase 3: Content Density + Hierarchy Updates

- Convert profile/info boxes to `kv-grid`.
- Redesign ticket list rows for compact scanning.
- Apply section ordering rules on ticket detail pages.
- Normalize heading levels and spacing across all screens.

### Phase 4: QA + Regression Updates

- Update e2e specs expecting global logout:
  - [`tests/frontend/e2e/specs/m1_auth_and_role_routing.spec.mjs`](/Users/nikhiltr/helpdesk/tests/frontend/e2e/specs/m1_auth_and_role_routing.spec.mjs)
  - [`tests/frontend/e2e/specs/m2_resident_ticket_comment_flow.spec.mjs`](/Users/nikhiltr/helpdesk/tests/frontend/e2e/specs/m2_resident_ticket_comment_flow.spec.mjs)
  - [`tests/frontend/e2e/specs/m5_cross_role_lifecycle.spec.mjs`](/Users/nikhiltr/helpdesk/tests/frontend/e2e/specs/m5_cross_role_lifecycle.spec.mjs)
- Add accessibility checks for heading order, contrast, focus visibility, and touch target size.

---

## 12. Acceptance Criteria

Revamp is complete when:

1. Logout appears only on account/profile pages.
2. All primary task pages keep one clear primary action.
3. Ticket and metadata scanning time is reduced via compact row layout and `kv-grid`.
4. Visual hierarchy is obvious on 320px screens without zooming.
5. Core flows remain JS-free and pass existing workflow tests after selector updates.
6. No new network dependencies (fonts/images/libs) are introduced.
