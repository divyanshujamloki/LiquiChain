import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: "./e2e",
  testMatch: /smoke\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3456",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npx --yes serve@14 out -l 3456",
    cwd: rootDir,
    url: "http://127.0.0.1:3456",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
