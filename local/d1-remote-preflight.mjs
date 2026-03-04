import fs from "node:fs";
import path from "node:path";

function fail(message) {
  console.error(`preflight failed: ${message}`);
  process.exit(1);
}

const rootDir = process.cwd();
const lessonsPath = path.join(rootDir, "codex", "lessons.md");

if (!fs.existsSync(lessonsPath)) {
  fail(`missing ${lessonsPath}`);
}

const lessons = fs.readFileSync(lessonsPath, "utf8");
if (!lessons.includes("Remote D1 import through Wrangler should avoid explicit SQL `BEGIN/COMMIT` in seed files.")) {
  fail("expected remote D1 no-BEGIN/COMMIT rule is missing in codex/lessons.md");
}

console.log("d1 remote preflight: OK");
console.log("- lessons reviewed: codex/lessons.md");
console.log("- use --remote explicitly");
console.log("- avoid BEGIN/COMMIT/SAVEPOINT in import SQL");
