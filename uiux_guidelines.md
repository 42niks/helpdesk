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
- Prefer compact vertical rhythm on mobile; avoid stacking multiple large margins in sequence.
- Use key-value layouts only for truly structured metadata; use full-width blocks for long text content.

## Navigation and IA

- Top navigation is lightweight and role-aware.
- Use left for back navigation, center for low-priority identity/context, right for compact state/type chip.
- Standardize resident back-navigation pill label as `← Home` (use unicode arrow, not `->`/`<-` ASCII variants).
- Logout is shown only in account/profile pages:
  - `/resident/account`
  - `/admin/account`
  - `/staff/account`
- No logout on role homes, ticket detail, create-ticket, or ratings pages.

## Components

- `app-shell`: centered content container.
- `top-nav`: route links for context navigation.
- `resident-meta`: compact info card for dense metadata and ownership/contact details.
- `ticket-item`: dense ticket rows with title, status chip, and compact metadata.
- `progress line`: short lifecycle tracker with clear current-step emphasis.
- `activity timeline`: chronological feed that can mix system events and human comments.
- `rating control`: tap-friendly 1-5 pill radios (not dropdown), with clear selected state and endpoint hints (`Poor`, `Excellent`).
- `pagination row`: compact count + previous/next controls for long lists; keep touch targets clear and avoid infinite scroll for core ticket/review lists.
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
- Put primary context first, actions later. On detail pages, forms should usually come after history/context.
- Do not duplicate the same information in multiple adjacent blocks (for example, same status shown repeatedly).
- When rating is required by workflow, enforce it in both UI affordance and server-side validation.
- Use predictable page sizes on mobile list views to keep load/render stable; show visible list position context (`Showing X-Y of Z`).

## Detail Screen Structure

- Ticket detail is a shared screen pattern across actors; keep core layout consistent and swap only role-specific action blocks.
- Header: progress + primary title.
- Freshness metadata: prioritize `Updated` over less critical fields.
- Core content block: main description/details in readable full-width text.
- Context blocks: keep resident/request context and assignee/contact details in compact cards without duplicating the same metadata in multiple places.
- Unified activity history: single chronological stream for events and comments.
- Action section: role-specific update controls appear after timeline/context.
- Add-comment composer should be the final block on the page and should be hidden when comments are not allowed.

## Activity Feed Patterns

- Prefer one timeline over split histories when users need a single source of truth.
- Differentiate entry types with subtle cues (iconography, dot style, mild tint), not heavy color.
- Keep timestamp placement consistent across entry types for quick scanning.
- Human actions and system actions should have distinct but calm visual language.
- Chronological ordering of timeline entries is a cross-role invariant and should remain consistent for resident, admin, and staff views.

## Queue and Listing Patterns

- For long ticket/review lists, use explicit pagination with visible position context (`Showing X-Y of Z`) and clear previous/next actions.
- Admin home queue is currently unfiltered for faster mobile scanning; prioritize clear card hierarchy and lightweight inline action/aging signals over heavy controls.
- On admin ticket cards, keep aging/action pills inline with the subtitle row, right-aligned, and allow subtitle truncation to preserve pill visibility.
- Keep ticket row hierarchy consistent across roles: identity/status first line, title as dominant line, compact metadata chips below.

## Performance Rules

- No external fonts.
- No image assets required.
- CSS-only subtle page-load fade (respects reduced-motion).
- Keep markup shallow and text-scannable.

## QA Expectations

- Role flows remain intact for resident/admin/staff.
- Logout remains accessible only from account pages.
- Lifecycle transitions and timeline ordering remain correct across states.
- Mobile layouts remain readable without horizontal overflow at 320px width.
- Shared detail-page structure stays aligned across roles, while role-specific controls remain contextual.
