import http from "node:http";
import path from "node:path";
import { createApp } from "../src/app/index.mjs";
import { createNodeDbAdapter } from "../src/app/db/node-adapter.mjs";
import { applyMigrations } from "../src/app/migrations.mjs";

const port = Number.parseInt(process.env.PORT || "8787", 10);
const host = process.env.HOST || "127.0.0.1";
const sqlitePath = process.env.SQLITE_PATH || "local-dev-db";
const migrationsDir = path.resolve(process.cwd(), "migrations");
applyMigrations({ sqlitePath, migrationsDir });

const db = createNodeDbAdapter(sqlitePath);
const app = createApp({
  db,
  environment: "local",
});

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function responseHeaders(response) {
  const headers = {};
  for (const [name, value] of response.headers.entries()) {
    if (name.toLowerCase() === "set-cookie") {
      continue;
    }
    headers[name] = value;
  }
  if (typeof response.headers.getSetCookie === "function") {
    const setCookies = response.headers.getSetCookie();
    if (setCookies.length > 0) {
      headers["set-cookie"] = setCookies;
    }
  } else {
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      headers["set-cookie"] = setCookie;
    }
  }
  return headers;
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const body =
      req.method === "GET" || req.method === "HEAD" ? undefined : await readRequestBody(req);
    const request = new Request(requestUrl, {
      method: req.method,
      headers: req.headers,
      body,
    });
    const response = await app.fetch(request);
    res.writeHead(response.status, responseHeaders(response));
    if (!response.body) {
      res.end();
      return;
    }
    const payload = Buffer.from(await response.arrayBuffer());
    res.end(payload);
  } catch (error) {
    res.writeHead(500, {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(`server error: ${String(error)}`);
  }
});

server.listen(port, host, () => {
  console.log(`ok: http://${host}:${port}/ (sqlite: ${sqlitePath})`);
});
