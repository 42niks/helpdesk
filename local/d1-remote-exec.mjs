import { execFileSync } from "node:child_process";

function fail(message) {
  console.error(`d1 remote exec failed: ${message}`);
  process.exit(1);
}

const sql = process.argv[2];
if (!sql) {
  fail("usage: npm run d1:remote:exec -- \"select 1;\"");
}

execFileSync("node", ["local/d1-remote-preflight.mjs"], {
  stdio: "inherit",
});

execFileSync("npx", ["wrangler", "d1", "execute", "helpdesk-db", "--remote", "--command", sql], {
  stdio: "inherit",
});
