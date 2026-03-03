import path from "node:path";
import { defineConfig } from "@playwright/test";

const sqlitePath = process.env.E2E_SQLITE_PATH || path.resolve(process.cwd(), ".tmp/e2e.db");
const e2ePort = Number.parseInt(process.env.E2E_PORT || "8788", 10);
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;
const viewportMatrix = [
  { label: "320x568", width: 320, height: 568 },
  { label: "375x812", width: 375, height: 812 },
  { label: "390x844", width: 390, height: 844 },
  { label: "768x1024", width: 768, height: 1024 },
  { label: "1280x800", width: 1280, height: 800 },
];
const browserMatrix = ["chromium", "firefox", "webkit"];
const projects = browserMatrix.flatMap((browserName) =>
  viewportMatrix.map((viewport) => ({
    name: `${browserName}-${viewport.label}`,
    use: {
      browserName,
      viewport: {
        width: viewport.width,
        height: viewport.height,
      },
    },
  })),
);

export default defineConfig({
  testDir: "./tests/frontend/e2e/specs",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: e2eBaseUrl,
    headless: true,
  },
  webServer: {
    command: `PORT=${e2ePort} SQLITE_PATH=${sqlitePath} npm run dev`,
    url: `${e2eBaseUrl}/_health/`,
    timeout: 120_000,
    reuseExistingServer: false,
  },
  projects,
});
