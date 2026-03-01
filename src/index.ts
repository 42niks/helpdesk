type Env = {
  DB: D1Database;
};

function html(body: string, status = 200): Response {
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${body}`, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function text(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_health/") {
      return text("ok");
    }

    if (url.pathname === "/_db/") {
      try {
        const row = await env.DB.prepare("select value from meta where key = 'schema_version'").first<{ value: string }>();
        return text(`db ok (schema_version=${row?.value ?? "unknown"})`);
      } catch (error) {
        return text(`db error: ${String(error)}`, 500);
      }
    }

    if (url.pathname === "/") {
      return html(`
        <title>Helpdesk</title>
        <main style="max-width:480px;margin:24px auto;padding:0 16px;font-family:system-ui, -apple-system, Segoe UI, Roboto, sans-serif;line-height:1.4">
          <h1 style="margin:0 0 12px">Helpdesk</h1>
          <p style="margin:0 0 16px">Deployed on Cloudflare Workers + D1.</p>
          <ul style="padding-left:18px">
            <li><a href="/_health/">Health</a></li>
            <li><a href="/_db/">DB check</a></li>
          </ul>
        </main>
      `);
    }

    return text("Not found", 404);
  },
};

