import path from "node:path";
import { defineConfig } from "@playwright/test";

const sqlitePath = process.env.E2E_SQLITE_PATH || path.resolve(process.cwd(), ".tmp/e2e.db");

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:8787",
    headless: true,
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: `SQLITE_PATH=${sqlitePath} npm run dev`,
    url: "http://127.0.0.1:8787/_health/",
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
