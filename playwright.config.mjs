import path from "node:path";
import { defineConfig } from "@playwright/test";

const sqlitePath = process.env.E2E_SQLITE_PATH || path.resolve(process.cwd(), ".tmp/e2e.db");
const e2ePort = Number.parseInt(process.env.E2E_PORT || "8788", 10);
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: e2eBaseUrl,
    headless: true,
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: `PORT=${e2ePort} SQLITE_PATH=${sqlitePath} npm run dev`,
    url: `${e2eBaseUrl}/_health/`,
    timeout: 120_000,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
      },
    },
  ],
});
