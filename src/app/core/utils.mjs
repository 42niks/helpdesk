const RUNTIME_ENV = globalThis.process?.env || {};
const SESSION_COOKIE_NAME = RUNTIME_ENV.SESSION_COOKIE_NAME || "helpdesk_session";
const SESSION_TTL_HOURS = Number.parseInt(RUNTIME_ENV.SESSION_TTL_HOURS || "168", 10);
const ADMIN_QUEUE_ALLOWED_PAGE_SIZES = new Set([10, 20, 50]);
const ADMIN_QUEUE_DEFAULT_PAGE_SIZE = 20;
const ADMIN_QUEUE_MAX_PAGE_SIZE = 100;

function now() {
  return new Date();
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function htmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseCookies(rawCookie) {
  const cookies = {};
  if (!rawCookie) {
    return cookies;
  }
  for (const part of rawCookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (!name) {
      continue;
    }
    cookies[name] = rest.join("=");
  }
  return cookies;
}

function baseHeaders() {
  return {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  };
}

function text(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function doc(title, body) {
  return [
    "<!doctype html>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${htmlEscape(title)}</title>`,
    "<style>",
    ":root {",
    "  color-scheme: light;",
    "  --bg-canvas: #f3f5f7;",
    "  --bg-surface: #ffffff;",
    "  --text-primary: #1f2933;",
    "  --text-muted: #52606d;",
    "  --border-subtle: #d9e2ec;",
    "  --accent: #0b7285;",
    "  --accent-soft: #e6f4f7;",
    "  --danger: #b42318;",
    "  --success: #1f7a43;",
    '  --font-ui: "Trebuchet MS", "Verdana", "Segoe UI", sans-serif;',
    '  --font-title: "Georgia", "Times New Roman", serif;',
    '  --font-data: "Consolas", "Menlo", monospace;',
    "}",
    "* { box-sizing: border-box; }",
    "html, body { margin: 0; padding: 0; }",
    "body {",
    "  background: var(--bg-canvas);",
    "  background-image: linear-gradient(to bottom, rgba(11, 114, 133, 0.03) 1px, transparent 1px);",
    "  background-size: 100% 28px;",
    "  color: var(--text-primary);",
    "  font-family: var(--font-ui);",
    "  font-size: 15px;",
    "  line-height: 1.45;",
    "}",
    "main.app-shell {",
    "  max-width: min(560px, 100vw);",
    "  margin: 0 auto;",
    "  min-height: 100vh;",
    "  padding: 20px 14px 28px;",
    "  background: var(--bg-surface);",
    "}",
    "@media (min-width: 480px) { main.app-shell { padding-left: 18px; padding-right: 18px; } }",
    "h1, h2, h3 { color: var(--text-primary); }",
    "h1 {",
    "  margin: 0;",
    "  font-family: var(--font-title);",
    "  font-size: 1.375rem;",
    "  line-height: 1.22;",
    "  font-weight: 700;",
    "}",
    "h2 { margin: 0; font-size: 1rem; line-height: 1.35; font-weight: 600; }",
    "h3 { margin: 0; font-size: 0.9375rem; line-height: 1.35; font-weight: 600; }",
    "p { margin: 8px 0; }",
    "a { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }",
    "a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {",
    "  outline: 2px solid var(--accent);",
    "  outline-offset: 2px;",
    "}",
    ".top-nav {",
    "  margin: 0 0 16px;",
    "  padding: 8px 0 10px;",
    "  border-bottom: 1px solid var(--border-subtle);",
    "  position: relative;",
    "  display: flex;",
    "  flex-wrap: wrap;",
    "  gap: 8px 12px;",
    "  align-items: center;",
    "}",
    ".top-nav a { font-size: 0.8125rem; }",
    ".top-nav .nav-home-pill { display: inline-flex; align-items: center; justify-content: center; min-height: 36px; padding: 0 12px; border: 1px solid #cbd5e1; border-radius: 999px; background: #f8fafc; color: #334155; text-decoration: none; font-weight: 600; }",
    ".top-nav a.nav-home-pill:hover { background: #f1f5f9; border-color: #94a3b8; }",
    ".top-nav .nav-link-right { margin-left: auto; }",
    ".top-nav .nav-ticket-center { position: absolute; left: 50%; transform: translateX(-50%); white-space: nowrap; }",
    ".top-nav .nav-meta { color: var(--text-muted); font-size: 0.75rem; }",
    "@media (max-width: 420px) { .top-nav .nav-ticket-center { position: static; transform: none; order: 3; flex-basis: 100%; text-align: center; } }",
    ".top-nav.top-nav--with-ticket-center { flex-wrap: nowrap; }",
    ".top-nav.top-nav--with-ticket-center .nav-ticket-center { position: absolute; left: 50%; transform: translateX(-50%); white-space: nowrap; }",
    "@media (max-width: 420px) { .top-nav.top-nav--with-ticket-center .nav-ticket-center { position: absolute; left: 50%; transform: translateX(-50%); order: 0; flex-basis: auto; text-align: inherit; } }",
    ".page-header { margin-bottom: 14px; }",
    ".page-header-centered { text-align: center; }",
    ".resident-home-header { text-align: center; }",
    ".resident-home-header h1 { font-family: var(--font-ui); font-size: 2.25rem; line-height: 1.06; letter-spacing: 0.02em; }",
    ".resident-home-header .page-subtitle { font-size: 0.8125rem; letter-spacing: 0.01em; }",
    ".resident-home-header .profile-flat-subtitle { font-size: clamp(1.35rem, 6vw, 1.95rem); font-weight: 700; letter-spacing: 0.01em; color: var(--text-primary); margin-top: 8px; }",
    ".home-header { text-align: center; margin-bottom: 18px; }",
    '.home-header h1 { font-family: "Open Sans", "Helvetica Neue", "Arial", sans-serif; font-size: clamp(2.75rem, 12vw, 4.25rem); line-height: 1.02; letter-spacing: 0.05em; font-weight: 800; }',
    ".home-header .home-subtitle { max-width: 34ch; margin-left: auto; margin-right: auto; text-align: center; }",
    ".login-card { border: 1px solid var(--border-subtle); border-radius: 12px; padding: 14px; background: var(--bg-surface); box-shadow: 0 10px 22px rgba(15, 23, 42, 0.06); }",
    ".page-subtitle { margin: 6px 0 0; color: var(--text-muted); font-size: 0.8125rem; }",
    ".section { margin-top: 16px; }",
    ".section-header { margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }",
    ".active-count-number { font-size: 1.3em; font-weight: 700; line-height: 1; }",
    ".active-count-label { font-size: 0.92em; }",
    ".section-header-actions { margin-left: auto; display: flex; align-items: center; }",
    ".inline-action-form { margin: 0; }",
    ".button-compact { min-height: 32px; padding: 5px 10px; border-radius: 999px; font-size: 0.75rem; line-height: 1.1; font-weight: 700; }",
    ".section-note { margin: 4px 0 0; color: var(--text-muted); font-size: 0.8125rem; }",
    "label { display: block; margin: 10px 0 5px; font-size: 0.8125rem; font-weight: 700; letter-spacing: 0.01em; }",
    ".issue-toggle-help { margin: -2px 0 8px; }",
    ".issue-toggle { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 10px 0 4px; }",
    ".issue-toggle-option { position: relative; margin: 0; }",
    ".issue-toggle-option input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }",
    ".issue-toggle-option > span { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; border: 1px solid #cbd5e1; border-radius: 999px; background: #f8fafc; color: #334155; font-size: 0.875rem; font-weight: 600; padding: 0 14px; transition: background-color .12s ease, border-color .12s ease, color .12s ease; }",
    ".issue-toggle-option .issue-toggle-selected { display: none; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.01em; }",
    ".issue-toggle-option input:hover + span { background: #f1f5f9; border-color: #94a3b8; }",
    ".issue-toggle-option input:checked + span { border-color: var(--accent); background: var(--accent); color: #ffffff; }",
    ".issue-toggle-option input:checked + span .issue-toggle-selected { display: inline; }",
    ".issue-toggle-option input:focus-visible + span { outline: 2px solid var(--accent); outline-offset: 2px; }",
    ".rating-fieldset { border: 0; margin: 10px 0 0; padding: 0; }",
    ".rating-fieldset legend { margin: 0 0 6px; font-size: 0.8125rem; font-weight: 700; letter-spacing: 0.01em; }",
    ".rating-toggle { display: flex; gap: 8px; }",
    ".rating-toggle--range { flex-direction: row-reverse; }",
    ".rating-toggle-input { position: absolute; opacity: 0; pointer-events: none; }",
    ".rating-toggle-label { flex: 1; margin: 0; }",
    ".rating-toggle-label > span { display: flex; align-items: center; justify-content: center; min-height: 40px; border: 1px solid #cbd5e1; border-radius: 999px; background: #f8fafc; color: #334155; font-size: 0.875rem; font-weight: 700; transition: background-color .12s ease, border-color .12s ease, color .12s ease; }",
    ".rating-toggle-label:hover > span { background: #f1f5f9; border-color: #94a3b8; }",
    ".rating-toggle-input:focus-visible + .rating-toggle-label > span { outline: 2px solid var(--accent); outline-offset: 2px; }",
    ".rating-toggle-input:checked + .rating-toggle-label > span { border-color: var(--accent); background: var(--accent); color: #ffffff; }",
    ".rating-toggle-input:checked ~ .rating-toggle-label > span { border-color: var(--accent); background: var(--accent); color: #ffffff; }",
    ".rating-extremes { margin: 6px 0 0; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); }",
    ".rating-extremes span { display: inline-block; }",
    ".rating-extremes span:first-child { grid-column: 1; justify-self: center; }",
    ".rating-extremes span:last-child { grid-column: 5; justify-self: center; }",
    'input[type="text"], input[type="password"], select, textarea {',
    "  width: 100%;",
    "  min-height: 44px;",
    "  border: 1px solid var(--border-subtle);",
    "  border-radius: 8px;",
    "  background: var(--bg-surface);",
    "  color: var(--text-primary);",
    "  font: inherit;",
    "  padding: 10px 11px;",
    "}",
    "textarea { min-height: 112px; resize: vertical; }",
    "input::placeholder, textarea::placeholder { color: var(--text-muted); }",
    "button {",
    "  min-height: 44px;",
    "  border: 1px solid var(--accent);",
    "  border-radius: 8px;",
    "  background: var(--accent);",
    "  color: #ffffff;",
    "  font: inherit;",
    "  font-weight: 600;",
    "  padding: 10px 12px;",
    "  cursor: pointer;",
    "}",
    "button:disabled { opacity: 0.6; cursor: not-allowed; }",
    ".wide-button { width: 100%; margin-top: 12px; }",
    ".login-submit { display: block; width: min(160px, 100%); margin-left: auto; margin-right: auto; }",
    ".button-danger { border-color: var(--danger); background: var(--danger); }",
    ".button-secondary { border-color: #94a3b8; background: #f1f5f9; color: #334155; }",
    ".action-form { margin: 12px 0 0; }",
    ".action-form.sticky-cta { position: sticky; bottom: 10px; background: var(--bg-surface); padding-top: 8px; }",
    ".inline-form { margin: 0; }",
    ".admin-filter-form { display: grid; }",
    ".admin-filter-form label { margin-top: 8px; }",
    ".admin-filter-form .wide-button { margin-top: 10px; }",
    ".ticket-summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }",
    ".ticket-summary-stat { border: 1px solid var(--border-subtle); border-radius: 10px; padding: 10px; background: var(--bg-surface); position: relative; overflow: hidden; }",
    ".ticket-summary-stat::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: #cbd5e1; }",
    ".ticket-summary-stat--open::before { background: #64748b; }",
    ".ticket-summary-stat--assigned::before { background: #0891b2; }",
    ".ticket-summary-stat--in-progress::before { background: #0b7285; }",
    ".ticket-summary-label { margin: 0; color: var(--text-muted); font-size: 0.75rem; letter-spacing: 0.01em; }",
    ".ticket-summary-value { margin: 4px 0 0; font-family: var(--font-data); font-size: 1.25rem; line-height: 1; font-weight: 700; color: var(--text-primary); }",
    ".ticket-summary-aging { margin-top: 10px; }",
    ".ticket-summary-aging-row { margin: 0; display: flex; align-items: center; gap: 8px; justify-content: space-between; font-size: 0.8125rem; }",
    ".ticket-summary-aging-row + .ticket-summary-aging-row { margin-top: 6px; }",
    ".ticket-summary-aging-row strong { font-family: var(--font-data); font-size: 0.875rem; color: #854d0e; background: #fef9c3; border: 1px solid #facc15; border-radius: 999px; padding: 1px 7px; }",
    ".admin-ticket-priority-row { margin: 7px 0 4px; display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }",
    ".admin-ticket-flat { font-size: 1.22rem; line-height: 1.2; font-weight: 700; color: var(--text-primary); }",
    ".admin-ticket-issue { font-size: 0.78rem; line-height: 1.2; font-weight: 700; color: #0b4e58; background: #e6f4f7; border: 1px solid #b9dde3; border-radius: 999px; padding: 2px 8px; white-space: nowrap; }",
    ".admin-ticket-subtitle-row { margin: 0; display: flex; align-items: center; gap: 6px; min-width: 0; }",
    ".admin-ticket-subtitle { margin: 0; min-width: 0; flex: 1; color: var(--text-muted); font-size: 0.82rem; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".admin-ticket-inline-badges { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; }",
    ".form-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }",
    ".button-link { min-height: 44px; border: 1px solid var(--border-subtle); border-radius: 8px; background: #f8fafc; color: #334155; font: inherit; font-weight: 600; padding: 10px 12px; display: inline-flex; align-items: center; justify-content: center; text-decoration: none; }",
    ".button-link-full { width: 100%; }",
    ".button-link:hover { background: #f1f5f9; border-color: #94a3b8; }",
    ".button-link-disabled { opacity: 0.55; pointer-events: none; }",
    ".button-cancel { color: #334155; }",
    ".button-create { min-height: 44px; border: 1px solid var(--accent); border-radius: 8px; background: var(--accent); color: #ffffff; font: inherit; font-weight: 700; padding: 10px 12px; }",
    ".password-row { position: relative; }",
    ".password-row input { padding-right: 80px; }",
    ".password-toggle { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); min-height: 32px; padding: 4px 8px; border-radius: 6px; background: transparent; color: var(--accent); border: 1px solid var(--border-subtle); font-size: 0.75rem; font-weight: 700; }",
    ".password-toggle:hover { background: var(--accent-soft); }",
    ".resident-meta {",
    "  margin: 8px 0 10px;",
    "  padding: 10px 11px;",
    "  border: 1px solid var(--border-subtle);",
    "  border-radius: 10px;",
    "  background: var(--bg-surface);",
    "}",
    ".kv-grid { display: grid; gap: 4px; margin: 0; }",
    ".kv-grid p { margin: 0; color: var(--text-primary); font-size: 0.9375rem; }",
    ".kv-grid p strong { display: inline-block; min-width: 7.25rem; margin-right: 10px; color: var(--text-muted); font-size: 0.8125rem; font-weight: 600; }",
    "@media (max-width: 359px) { .kv-grid p strong { display: block; min-width: 0; margin-right: 0; margin-bottom: 2px; } }",
    ".message { padding: 10px 11px; border-radius: 8px; margin: 12px 0; font-size: 0.875rem; }",
    ".message.info { background: var(--accent-soft); border: 1px solid #b9dde3; color: #0b4e58; }",
    ".message.error { background: #fef2f2; border: 1px solid #fecaca; color: #7f1d1d; }",
    ".field-error { margin: 6px 0 0; color: var(--danger); font-size: 0.8125rem; }",
    ".ticket-list, .timeline, .comment-list { list-style: none; margin: 12px 0; padding: 0; display: grid; gap: 10px; }",
    ".ticket-item, .timeline-item, .comment-item {",
    "  border: 1px solid var(--border-subtle);",
    "  border-radius: 10px;",
    "  padding: 10px 11px;",
    "  background: var(--bg-surface);",
    "}",
    ".ticket-item { position: relative; overflow: hidden; }",
    ".ticket-item::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: #cbd5e1; }",
    ".ticket-item--open::before { background: #64748b; }",
    ".ticket-item--assigned::before { background: #0891b2; }",
    ".ticket-item--in_progress::before { background: #0b7285; }",
    ".ticket-item--completed::before { background: #16a34a; }",
    ".ticket-row-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }",
    ".ticket-row-head h3 { margin: 0; font-size: 0.6875rem; }",
    ".ticket-row-head--resident, .ticket-row-head--has-center-chip { position: relative; }",
    ".ticket-row-review-chip { position: absolute; left: 50%; transform: translateX(-50%); top: 0; display: inline-flex; align-items: center; min-height: 20px; padding: 1px 8px; border-radius: 999px; border: 1px solid #fed7aa; background: #fff7ed; color: #9a3412; font-size: 0.7rem; line-height: 1.1; font-weight: 600; white-space: nowrap; }",
    ".ticket-item-link { display: block; margin: -10px -11px; padding: 10px 11px 10px 14px; color: inherit; text-decoration: none; border-radius: 10px; }",
    ".ticket-item-link:hover { background: #f8fbfc; }",
    ".ticket-item-link:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }",
    ".ticket-number-link { font-family: var(--font-data); font-size: 0.6875rem; text-decoration: none; border-bottom: 1px dotted var(--accent); letter-spacing: 0.02em; }",
    ".ticket-row-title { margin: 7px 0 4px 0; font-size: 1.18rem; line-height: 1.22; font-weight: 700; color: var(--text-primary); }",
    ".ticket-row-meta { margin: 0; color: var(--text-muted); font-size: 0.765rem; line-height: 1.35; }",
    ".ticket-row-meta-chips { margin: 6px 0 0; display: flex; flex-wrap: wrap; gap: 6px; }",
    ".ticket-meta-chip { display: inline-flex; align-items: center; min-height: 22px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border-subtle); background: #f8fafc; color: #334155; font-size: 0.72rem; line-height: 1.2; }",
    ".ticket-meta-chip--updated { background: #ecfeff; border-color: #bae6fd; color: #155e75; }",
    ".ticket-meta-chip--aging { background: #fef9c3; border-color: #facc15; color: #854d0e; }",
    ".ticket-progress-line { list-style: none; margin: 0 0 16px; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }",
    ".ticket-progress-stop { position: relative; text-align: center; color: var(--text-muted); font-size: 0.66rem; line-height: 1.2; }",
    ".ticket-progress-stop::before { content: ''; position: absolute; top: 5px; left: calc(-50% + 6px); right: calc(50% + 6px); border-top: 2px solid var(--border-subtle); }",
    ".ticket-progress-stop:first-child::before { content: none; }",
    ".ticket-progress-dot { display: block; width: 8px; height: 8px; margin: 0 auto 6px; border-radius: 999px; border: 1px solid var(--border-subtle); background: #ffffff; }",
    ".ticket-progress-label { display: block; overflow-wrap: anywhere; }",
    ".ticket-progress-stop--done { color: var(--text-primary); }",
    ".ticket-progress-stop--done::before { border-top-color: var(--accent); }",
    ".ticket-progress-stop--done .ticket-progress-dot { background: var(--accent); border-color: var(--accent); }",
    ".ticket-progress-stop--current { color: var(--text-primary); font-size: 0.76rem; font-weight: 700; }",
    ".ticket-progress-stop--current::before { border-top-color: var(--accent); }",
    ".ticket-progress-stop--current .ticket-progress-dot { width: 12px; height: 12px; background: var(--success); border-color: var(--success); box-shadow: 0 0 0 2px #dcfce7; }",
    ".ticket-detail-title { white-space: normal; overflow-wrap: anywhere; }",
    ".detail-card { margin-top: 0; }",
    ".detail-card-row { margin: 0; font-size: 0.9375rem; }",
    ".detail-card-row + .detail-card-row { margin-top: 4px; }",
    ".detail-card-row strong { color: var(--text-muted); font-size: 0.8125rem; font-weight: 600; display: inline-block; min-width: 5.5rem; margin-right: 8px; }",
    ".detail-card-value { min-width: 0; overflow-wrap: anywhere; }",
    ".detail-card-row--multiline strong { display: block; min-width: 0; margin: 0 0 4px; }",
    ".detail-card-row--multiline .detail-card-value { display: block; white-space: pre-wrap; line-height: 1.45; }",
    ".assigned-tech-name-row { display: flex; align-items: center; gap: 8px; }",
    ".assigned-tech-name-row strong { flex: 0 0 auto; }",
    ".assigned-tech-status-text { margin-left: auto; color: var(--text-muted); font-size: 0.8125rem; font-weight: 400; white-space: nowrap; }",
    ".assigned-tech-assigned-row { display: flex; align-items: center; gap: 8px; }",
    ".assigned-tech-assigned-row strong { flex: 0 0 auto; }",
    ".assigned-tech-assigned-ago { margin-left: auto; color: var(--text-muted); font-size: 0.8125rem; white-space: nowrap; }",
    ".assigned-tech-contact-row { display: flex; align-items: center; gap: 8px; }",
    ".assigned-tech-contact-row strong { flex: 0 0 auto; }",
    ".assigned-tech-call-button { margin-left: auto; min-height: 28px; padding: 3px 8px; border: 1px solid #cbd5e1; border-radius: 999px; background: #f8fafc; color: #334155; text-decoration: none; font-size: 0.75rem; font-weight: 500; line-height: 1.1; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; }",
    ".assigned-tech-call-button:hover { background: #f1f5f9; border-color: #94a3b8; }",
    ".assigned-tech-call-button--icon { min-width: 28px; padding: 0; font-size: 0.8rem; }",
    ".meta-row { margin: 4px 0; font-size: 0.875rem; }",
    ".staff-summary-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }",
    ".staff-summary-left { min-width: 0; }",
    ".staff-summary-name { margin: 0; font-size: 1rem; line-height: 1.2; }",
    ".staff-summary-type { margin: 4px 0 0; color: var(--text-muted); font-size: 0.8125rem; }",
    ".staff-summary-right { text-align: right; flex-shrink: 0; }",
    ".staff-summary-average { margin: 0; font-size: 1.2rem; line-height: 1.1; font-weight: 800; color: var(--text-primary); }",
    ".staff-summary-star { color: #f59e0b; }",
    ".staff-summary-count { margin: 4px 0 0; color: var(--text-muted); font-size: 0.75rem; }",
    ".staff-performance-list { margin-top: 10px; }",
    ".staff-performance-card { padding-left: 14px; }",
    ".staff-performance-card::before { width: 5px; }",
    ".staff-performance-card--electrician::before { background: #0f766e; }",
    ".staff-performance-card--plumber::before { background: #2563eb; }",
    ".staff-performance-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }",
    ".staff-performance-name { margin: 0; font-size: 1.02rem; line-height: 1.2; padding-left: 2px; }",
    ".staff-type-pill { display: inline-flex; align-items: center; min-height: 24px; padding: 2px 10px; border-radius: 999px; border: 1px solid transparent; font-size: 0.74rem; line-height: 1.1; font-weight: 700; white-space: nowrap; }",
    ".staff-type-pill--electrician { color: #134e4a; background: #ccfbf1; border-color: #5eead4; }",
    ".staff-type-pill--plumber { color: #1e3a8a; background: #dbeafe; border-color: #93c5fd; }",
    ".staff-performance-metrics { margin-top: 10px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }",
    ".staff-performance-metric { margin: 0; padding: 8px 9px; border: 1px solid var(--border-subtle); border-radius: 8px; background: #f8fafc; min-height: 62px; }",
    ".staff-performance-metric-label { display: block; color: var(--text-muted); font-size: 0.72rem; letter-spacing: 0.01em; }",
    ".staff-performance-metric-value { display: block; margin-top: 4px; font-family: var(--font-data); font-size: 1rem; line-height: 1.2; color: var(--text-primary); }",
    ".pagination-row { margin-top: 10px; }",
    ".pagination-row .small { margin: 0 0 8px; }",
    ".pagination-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }",
    ".timeline { padding-left: 12px; }",
    ".timeline-item { position: relative; margin-left: 0; }",
    ".timeline-item::before { content: ''; position: absolute; left: -19px; top: 12px; width: 8px; height: 8px; border-radius: 999px; }",
    ".timeline-item::after { content: ''; position: absolute; left: -15px; top: 18px; bottom: -10px; border-left: 2px solid var(--border-subtle); }",
    ".timeline-item:last-child::after { content: none; }",
    ".timeline-item-head { margin: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }",
    ".timeline-type { display: inline-flex; align-items: center; min-height: 20px; padding: 1px 7px; border-radius: 999px; font-size: 0.72rem; line-height: 1; font-weight: 600; white-space: nowrap; }",
    ".timeline-item-title { font-size: 0.875rem; font-weight: 600; color: var(--text-primary); }",
    ".timeline-item--event { background: #f2f9fb; border-color: #c9e3ea; border-left: 3px solid #0b7285; border-radius: 8px; }",
    ".timeline-item--event::before { background: #0b7285; border: 1px solid #0b7285; }",
    ".timeline-item--event::after { border-left-color: #9eb7c2; border-left-style: solid; }",
    ".timeline-item--event .timeline-type { color: #0b4e58; background: #dff1f5; border: 1px solid #b9dde3; }",
    ".timeline-item--comment { background: #f8f7f4; border-color: #ddd8cc; border-left: 3px solid #7b8794; border-radius: 12px; }",
    ".timeline-item--comment::before { background: #ffffff; border: 1px solid #64748b; }",
    ".timeline-item--comment::after { border-left-color: #d5d9e0; border-left-style: dashed; }",
    ".timeline-item--comment .timeline-type { color: #475569; background: #eef2f6; border: 1px solid #d5dee8; }",
    ".comment-head { margin: 0; color: var(--text-muted); font-size: 0.8125rem; font-weight: 600; }",
    ".comment-body { margin: 6px 0 0; font-size: 0.9375rem; }",
    ".comment-item--linkable { padding: 0; }",
    ".comment-item-link { display: block; margin: 0; padding: 10px 11px; color: inherit; text-decoration: none; border-radius: 10px; }",
    ".comment-item-link:hover { background: #f8fbfc; }",
    ".comment-item-link:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }",
    ".small { color: var(--text-muted); font-size: 0.75rem; }",
    ".empty-state { margin: 12px 0; color: var(--text-muted); font-size: 0.8125rem; }",
    ".status-chip { display: inline-block; border-radius: 999px; padding: 2px 8px; border: 1px solid var(--border-subtle); font-size: 0.75rem; font-weight: 700; white-space: nowrap; }",
    ".status-chip--open { color: var(--text-primary); background: #eef2f5; }",
    ".status-chip--assigned { color: #0b4e58; background: var(--accent-soft); border-color: #b9dde3; }",
    ".status-chip--in_progress { color: #ffffff; background: var(--accent); border-color: var(--accent); }",
    ".status-chip--completed { color: var(--success); background: #edf7ef; border-color: #b7e0c4; }",
    ".badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.75rem; line-height: 1.2; border: 1px solid #facc15; background: #fef9c3; color: #854d0e; }",
    ".session-panel { border: 1px solid #fecaca; background: #fff7f7; }",
    ".session-panel h2 { margin: 0 0 4px; }",
    "pre { overflow: auto; white-space: pre-wrap; background: #f1f1f1; padding: 12px; border-radius: 8px; }",
    "@media (prefers-reduced-motion: no-preference) { main.app-shell { animation: page-fade 150ms ease-out; } }",
    "@keyframes page-fade { from { opacity: 0.96; } to { opacity: 1; } }",
    "</style>",
    `<main class="app-shell">${body}</main>`,
  ].join("");
}

function html(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      ...baseHeaders(),
      ...headers,
    },
  });
}

function roleHome(role) {
  if (role === "resident") {
    return "/resident";
  }
  if (role === "admin") {
    return "/admin";
  }
  return "/staff";
}

function roleHomeLabel(role) {
  if (role === "resident") {
    return "Go to Resident Home (All Tickets)";
  }
  if (role === "admin") {
    return "Go to Admin Home (All Tickets)";
  }
  if (role === "staff") {
    return "Go to Staff Home (Assigned Tickets)";
  }
  return "Go to Helpdesk";
}

function sessionCookie(token, environment) {
  const secure = environment === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

function clearSessionCookie(environment) {
  const secure = environment === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`;
}

function redirect(location, extraHeaders = {}) {
  return new Response(null, {
    status: 303,
    headers: {
      "cache-control": "no-store",
      location,
      ...extraHeaders,
    },
  });
}

function requestId() {
  return crypto.randomUUID();
}

function actorLogShape(session) {
  if (!session) {
    return null;
  }
  return {
    account_id: session.accountId,
    username: session.username,
    role: session.role,
  };
}

function writeStructuredLog(payload) {
  try {
    console.log(JSON.stringify(payload));
  } catch {}
}

function logRequestRecord({ requestIdValue, request, response, actor, startedAtMs }) {
  const durationMs = Math.max(0, Date.now() - startedAtMs);
  const url = new URL(request.url);
  writeStructuredLog({
    event: "request",
    request_id: requestIdValue,
    method: request.method,
    route: url.pathname,
    status: response.status,
    duration_ms: durationMs,
    actor,
    ts: new Date().toISOString(),
  });
}

function logMutationRecord({
  requestIdValue,
  route,
  action,
  ticketId,
  actor,
  details = {},
}) {
  writeStructuredLog({
    event: "mutation",
    request_id: requestIdValue,
    route,
    action,
    ticket_id: ticketId,
    actor,
    details,
    ts: new Date().toISOString(),
  });
}

function loginBanner(reason) {
  if (reason === "expired") {
    return '<div class="message info">Session expired. Please log in again.</div>';
  }
  if (reason === "logged_out") {
    return '<div class="message info">You have been logged out.</div>';
  }
  return "";
}

function loginPage({ reason = "", authError = "" }) {
  const errorHtml = authError
    ? `<div class="message error">${htmlEscape(authError)}</div>`
    : "";
  return doc(
    "Helpdesk",
    [
      '<header class="page-header home-header">',
      "<h1>Helpdesk</h1>",
      '<p class="page-subtitle home-subtitle">Apartment maintenance helpdesk for residents, admins, and staff.</p>',
      "</header>",
      '<section class="login-card">',
      loginBanner(reason),
      errorHtml,
      '<form method="post" action="/login" novalidate>',
      '<label for="username">Username</label>',
      '<input id="username" name="username" type="text" autocomplete="username" required>',
      '<label for="password">Password</label>',
      '<div class="password-row">',
      '<input id="password" name="password" type="password" autocomplete="current-password" required>',
      '<button type="button" class="password-toggle" id="password-toggle" aria-controls="password" aria-pressed="false">Show</button>',
      "</div>",
      '<button type="submit" class="wide-button login-submit">Login</button>',
      "</form>",
      "</section>",
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@800&display=swap">',
      "<script>",
      "(function(){",
      "  var toggle = document.getElementById('password-toggle');",
      "  var input = document.getElementById('password');",
      "  if (toggle && input) {",
      "    toggle.addEventListener('click', function(){",
      "      var reveal = input.type === 'password';",
      "      input.type = reveal ? 'text' : 'password';",
      "      toggle.textContent = reveal ? 'Hide' : 'Show';",
      "      toggle.setAttribute('aria-pressed', reveal ? 'true' : 'false');",
      "    });",
      "  }",
      "})();",
      "</script>",
    ].join(""),
  );
}

function navWithLogout({ csrfToken, links }) {
  const hasTicketCenter = links.some((entry) => String(entry.className || "").includes("nav-ticket-center"));
  const navClass = hasTicketCenter ? "top-nav top-nav--with-ticket-center" : "top-nav";
  const navLinks = links
    .map((entry) => {
      const classAttr = entry.className ? ` class="${htmlEscape(entry.className)}"` : "";
      if (entry.href) {
        return `<a href="${entry.href}"${classAttr}>${htmlEscape(entry.label)}</a>`;
      }
      return `<span${classAttr}>${htmlEscape(entry.label)}</span>`;
    })
    .join("");
  return [
    `<nav class="${navClass}">`,
    `<input type="hidden" name="csrf_token" value="${htmlEscape(csrfToken)}">`,
    navLinks,
    "</nav>",
  ].join("");
}

function logoutPanel({ csrfToken }) {
  return [
    '<section class="section resident-meta session-panel">',
    "<h2>Session</h2>",
    '<form method="post" action="/logout">',
    `<input type="hidden" name="csrf_token" value="${htmlEscape(csrfToken)}">`,
    '<button type="submit" class="wide-button button-danger">Logout</button>',
    "</form>",
    "</section>",
  ].join("");
}

function pageWithLogout({
  title,
  welcomeText,
  links,
  csrfToken,
  detailsHtml = "",
  primaryAction = null,
  primaryActionSticky = false,
  headerClass = "",
}) {
  const actionHtml = primaryAction
    ? [
      `<form class="action-form${primaryActionSticky ? " sticky-cta" : ""}" method="${primaryAction.method || "get"}" action="${primaryAction.href}">`,
      `<button type="submit" class="wide-button">${htmlEscape(primaryAction.label)}</button>`,
      "</form>",
    ].join("")
    : "";
  const hasSubtitle = typeof welcomeText === "string" && welcomeText.trim().length > 0;
  return doc(
    title,
    [
      navWithLogout({ csrfToken, links }),
      `<header class="page-header${headerClass ? ` ${htmlEscape(headerClass)}` : ""}">`,
      `<h1>${htmlEscape(title)}</h1>`,
      hasSubtitle ? `<p class="page-subtitle">${htmlEscape(welcomeText)}</p>` : "",
      "</header>",
      detailsHtml,
      actionHtml,
    ].join(""),
  );
}

function errorPage({ status, title, message, role, includeRetry, retryHref, details, requestIdValue }) {
  const homeHref = role ? roleHome(role) : "/";
  const homeLabel = roleHomeLabel(role);
  const retryHtml = includeRetry
    ? `<a href="${htmlEscape(retryHref)}">Retry Current Page</a>`
    : "";
  const detailsHtml = details
    ? `<h2>Error Details</h2><pre>${htmlEscape(details)}</pre>`
    : "";
  return html(
    doc(
      title,
      [
        `<nav class="top-nav"><a href="${homeHref}">${homeLabel}</a>${retryHtml}</nav>`,
        '<header class="page-header">',
        `<h1>${htmlEscape(title)}</h1>`,
        "</header>",
        `<p>${htmlEscape(message)}</p>`,
        `<p class="small">Request ID: ${htmlEscape(requestIdValue)}</p>`,
        detailsHtml,
      ].join(""),
    ),
    status,
  );
}

async function parseForm(request) {
  const formData = await request.formData();
  const values = {};
  for (const [key, value] of formData.entries()) {
    values[key] = typeof value === "string" ? value : "";
  }
  return values;
}

function issueTypeLabel(issueType) {
  if (issueType === "electrical") {
    return "Electrical";
  }
  if (issueType === "plumbing") {
    return "Plumbing";
  }
  return "Unknown";
}

function issueTypeToStaffType(issueType) {
  if (issueType === "electrical") {
    return "electrician";
  }
  if (issueType === "plumbing") {
    return "plumber";
  }
  return "";
}

function staffTypeLabel(staffType) {
  if (staffType === "electrician") {
    return "Electrician";
  }
  if (staffType === "plumber") {
    return "Plumber";
  }
  return "Unknown";
}

function statusLabel(status) {
  if (status === "open") {
    return "Open";
  }
  if (status === "assigned") {
    return "Assigned";
  }
  if (status === "in_progress") {
    return "In Progress";
  }
  if (status === "completed") {
    return "Completed";
  }
  return "Unknown";
}

function formatTicketNumber(apartmentCode, ticketId) {
  return `${apartmentCode}-${String(ticketId).padStart(6, "0")}`;
}

function parsePositiveInt(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseAdminQueueFilters(url) {
  const statusRaw = (url.searchParams.get("status") || "").trim().toLowerCase();
  const issueTypeRaw = (url.searchParams.get("issue_type") || "").trim().toLowerCase();
  const assignedStaffRaw = (url.searchParams.get("assigned_staff") || "").trim().toLowerCase();
  const needsReviewRaw = (url.searchParams.get("needs_review") || "").trim().toLowerCase();

  const status = ["open", "assigned", "in_progress", "completed"].includes(statusRaw) ? statusRaw : "";
  const issueType = ["electrical", "plumbing"].includes(issueTypeRaw) ? issueTypeRaw : "";

  let assignedStaff = "";
  if (assignedStaffRaw === "unassigned") {
    assignedStaff = "unassigned";
  } else {
    const parsedStaffId = parsePositiveInt(assignedStaffRaw);
    if (parsedStaffId) {
      assignedStaff = String(parsedStaffId);
    }
  }

  const page = parsePositiveInt(url.searchParams.get("page")) || 1;
  const parsedPageSize = parsePositiveInt(url.searchParams.get("page_size"));
  const pageSize = parsedPageSize
    ? Math.min(parsedPageSize, ADMIN_QUEUE_MAX_PAGE_SIZE)
    : ADMIN_QUEUE_DEFAULT_PAGE_SIZE;

  return {
    status,
    issueType,
    assignedStaff,
    needsReview: needsReviewRaw === "1" || needsReviewRaw === "true",
    page,
    pageSize,
  };
}

function parseIsoToMillis(value) {
  const millis = Date.parse(value || "");
  if (Number.isNaN(millis)) {
    return null;
  }
  return millis;
}

function ticketAgingBadge(ticket, nowMillis) {
  if (ticket.status === "open" && !ticket.assigned_staff_account_id) {
    const createdMillis = parseIsoToMillis(ticket.created_at);
    if (createdMillis !== null && nowMillis - createdMillis >= 24 * 60 * 60 * 1000) {
      return "Unassigned >24h";
    }
  }

  if (ticket.status === "in_progress") {
    const startedMillis = parseIsoToMillis(ticket.in_progress_at || ticket.updated_at || ticket.created_at);
    if (startedMillis !== null && nowMillis - startedMillis >= 72 * 60 * 60 * 1000) {
      return "In Progress >72h";
    }
  }

  return "";
}

function ratingLabel(rating) {
  if (!Number.isInteger(rating)) {
    return "N/A";
  }
  return `${rating}/5`;
}

function formatAverageRating(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "N/A";
  }
  return Number(value).toFixed(2);
}

function parseTicketId(pathname, pattern) {
  const match = pathname.match(pattern);
  if (!match) {
    return null;
  }
  const ticketId = Number.parseInt(match[1], 10);
  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    return null;
  }
  return ticketId;
}

export {
  SESSION_COOKIE_NAME,
  SESSION_TTL_HOURS,
  now,
  addHours,
  doc,
  htmlEscape,
  parseCookies,
  text,
  html,
  roleHome,
  roleHomeLabel,
  sessionCookie,
  clearSessionCookie,
  redirect,
  requestId,
  actorLogShape,
  logRequestRecord,
  logMutationRecord,
  loginPage,
  navWithLogout,
  logoutPanel,
  pageWithLogout,
  errorPage,
  parseForm,
  issueTypeLabel,
  issueTypeToStaffType,
  staffTypeLabel,
  statusLabel,
  formatTicketNumber,
  parsePositiveInt,
  parseAdminQueueFilters,
  ticketAgingBadge,
  ratingLabel,
  formatAverageRating,
  parseTicketId,
};
