# UI/UX Guidelines (Implemented Flavor)

## Product Tone

- Mobile-first, text-first, no image dependency.
- Minimal, readable, and fast on low-end devices.
- Single clear primary action per workflow screen.

## Visual System

### Color Tokens

```css
:root {
  --bg-canvas: #f3f5f7;
  --bg-surface: #ffffff;
  --text-primary: #1f2933;
  --text-muted: #52606d;
  --border-subtle: #d9e2ec;
  --accent: #0b7285;
  --accent-soft: #e6f4f7;
  --danger: #b42318;
  --success: #1f7a43;
}
```

### Typography

- UI text stack: `Trebuchet MS`, `Verdana`, `Segoe UI`, sans-serif.
- Heading stack: `Georgia`, `Times New Roman`, serif.
- Ticket/id text stack: `Consolas`, `Menlo`, monospace.
- Core sizes:
  - `h1`: 22px
  - `h2`: 17px
  - `h3` / body strong: 15px
  - meta/support: 13px
  - timestamp/caption: 12px

## Layout and Spacing

- Main shell max width: 560px.
- Mobile baseline target: 320px.
- Horizontal padding: 14px mobile, 18px at >=480px.
- Rhythm: 4px spacing grid.
- Key-value sections use 2-column `dl.kv-grid` and collapse to single column under 360px.

## Navigation and IA

- Top navigation is links-only.
- Logout is shown only in account/profile pages:
  - `/resident/account`
  - `/admin/account`
  - `/staff/account`
- No logout on role homes, ticket detail, create-ticket, or ratings pages.

## Components

- `app-shell`: centered content container.
- `top-nav`: route links for context navigation.
- `resident-meta kv-grid`: compact key-value blocks.
- `ticket-item`: dense ticket rows with title, status chip, and compact metadata.
- `status-chip` variants:
  - `open`
  - `assigned`
  - `in_progress`
  - `completed`
- `session-panel`: destructive session action area for logout.
- `message info/error`: feedback blocks.

## Interaction Rules

- Minimum interactive height: 44px.
- Strong visible keyboard focus ring.
- Preserve no-JS functionality for all core flows.
- Keep forms linear and explicit (label above field).

## Ticket Screen Structure

- Header and ticket identity.
- Summary key-value block.
- Assignment block.
- Action block (assign/status/review/comment form by role/state).
- Timeline.
- Comments history.

## Performance Rules

- No external fonts.
- No image assets required.
- CSS-only subtle page-load fade (respects reduced-motion).
- Keep markup shallow and text-scannable.

## QA Expectations

- Role flows remain intact for resident/admin/staff.
- Logout remains accessible only from account pages.
- Ticket lifecycle flows continue to pass E2E tests.
