import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import { hasFoundryOnPath } from "./e2e/hasFoundry";

const webDir = path.dirname(fileURLToPath(import.meta.url));
const chain = hasFoundryOnPath();

export default defineConfig({
  testDir: "./e2e",
  testMatch: /wallet-anvil\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3457",
    trace: "on-first-retry",
    launchOptions: {
      args: [
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
      ],
    },
  },
  webServer: chain
    ? {
        command: "node ./scripts/start-e2e-environment.mjs",
        cwd: webDir,
        url: "http://127.0.0.1:3457",
        reuseExistingServer: false,
        timeout: 240_000,
        stdout: "pipe",
        stderr: "pipe",
      }
    : {
        command: "npx --yes serve@14 out -l 3457",
        cwd: webDir,
        url: "http://127.0.0.1:3457",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
