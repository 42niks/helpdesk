import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const port = Number.parseInt(process.env.PORT || "8787", 10);
const host = process.env.HOST || "127.0.0.1";
const sqlitePath = process.env.SQLITE_PATH || "local.db";
const migrationsPath = path.resolve(process.cwd(), "migrations", "0001_init.sql");

function respond(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function respondText(res, status, body) {
  respond(
    res,
    status,
    { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    body,
  );
}

function respondHtml(res, status, body) {
  const doc =
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    body;
  respond(
    res,
    status,
    { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    doc,
  );
}

// Ensure schema exists.
{
  const migrationSql = fs.readFileSync(migrationsPath, "utf8");
  const db = new DatabaseSync(sqlitePath);
  db.exec(migrationSql);
  db.close();
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/_health/") {
    return respondText(res, 200, "ok");
  }

  if (url.pathname === "/_db/") {
    try {
      const db = new DatabaseSync(sqlitePath);
      const row = db
        .prepare("select value from meta where key = 'schema_version'")
        .get();
      db.close();
      return respondText(res, 200, `db ok (schema_version=${row?.value ?? "unknown"})`);
    } catch (error) {
      return respondText(res, 500, `db error: ${String(error)}`);
    }
  }

  if (url.pathname === "/") {
    return respondHtml(
      res,
      200,
      `
        <title>Helpdesk (Local)</title>
        <main style="max-width:480px;margin:24px auto;padding:0 16px;font-family:system-ui, -apple-system, Segoe UI, Roboto, sans-serif;line-height:1.4">
          <h1 style="margin:0 0 12px">Helpdesk (Local)</h1>
          <p style="margin:0 0 8px">Server: Node.js (fully local)</p>
          <p style="margin:0 0 16px">DB: SQLite file <code>${sqlitePath}</code></p>
          <ul style="padding-left:18px">
            <li><a href="/_health/">Health</a></li>
            <li><a href="/_db/">DB check</a></li>
          </ul>
          <p style="margin:16px 0 0;color:#555">
            You can inspect the DB with: <code>sqlite3 ${sqlitePath}</code>
          </p>
        </main>
      `,
    );
  }

  return respondText(res, 404, "Not found");
});

server.listen(port, host, () => {
  console.log(`ok: http://${host}:${port}/ (sqlite: ${sqlitePath})`);
});

