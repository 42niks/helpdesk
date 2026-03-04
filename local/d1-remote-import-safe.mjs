import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

function fail(message) {
  console.error(`d1 remote import failed: ${message}`);
  process.exit(1);
}

const sourcePath = process.argv[2];
if (!sourcePath) {
  fail("usage: npm run d1:remote:import -- /absolute/or/relative/file.sql");
}
if (!fs.existsSync(sourcePath)) {
  fail(`input SQL file not found: ${sourcePath}`);
}

execFileSync("node", ["local/d1-remote-preflight.mjs"], {
  stdio: "inherit",
});

const originalSql = fs.readFileSync(sourcePath, "utf8");
const blockedPattern = /^\s*(BEGIN|COMMIT|SAVEPOINT|RELEASE|ROLLBACK)\b/im;
if (blockedPattern.test(originalSql)) {
  console.warn("warning: transaction statements found; stripping for remote D1 import");
}

const sanitizedSql = originalSql
  .split(/\r?\n/)
  .filter((line) => !/^\s*(BEGIN|COMMIT|SAVEPOINT|RELEASE|ROLLBACK)\b/i.test(line))
  .join("\n");

const tempPath = path.join(
  os.tmpdir(),
  `helpdesk-remote-d1-import-${Date.now()}-${Math.random().toString(16).slice(2)}.sql`,
);
fs.writeFileSync(tempPath, sanitizedSql, "utf8");

try {
  execFileSync("npx", ["wrangler", "d1", "execute", "helpdesk-db", "--remote", "--file", tempPath], {
    stdio: "inherit",
  });
} finally {
  fs.rmSync(tempPath, { force: true });
}
