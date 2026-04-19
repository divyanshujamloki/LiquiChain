/**
 * Starts Anvil, deploys mocks, copies deployments into static `out/`, serves on 3457.
 * Requires: Foundry (`anvil`, `forge` on PATH) and `apps/web/out` from `pnpm build`.
 */
import { spawn, execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webDir = join(__dirname, "..");
const repoRoot = join(webDir, "..", "..");
const useShell = process.platform === "win32";

function waitPort(port, timeout = 90_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (Date.now() - start > timeout) {
        reject(new Error(`Timeout waiting for port ${port}`));
        return;
      }
      const socket = net.createConnection({ port, host: "127.0.0.1" }, () => {
        socket.end();
        resolve(undefined);
      });
      socket.on("error", () => {
        setTimeout(attempt, 250);
      });
    };
    attempt();
  });
}

const outDir = join(webDir, "out");
if (!existsSync(outDir)) {
  console.error("[e2e] Missing apps/web/out — run: pnpm --filter @nfs/web build");
  process.exit(1);
}

const anvil = spawn("anvil", ["--host", "127.0.0.1", "--port", "8545"], {
  cwd: repoRoot,
  stdio: "ignore",
  detached: false,
  shell: useShell,
});

anvil.on("error", (err) => {
  console.error("[e2e] Could not start `anvil`. Install Foundry: https://getfoundry.sh", err.message);
  process.exit(1);
});

await waitPort(8545);
console.log("[e2e] anvil up on 8545");

execSync(
  "forge script script/DeployMocks.s.sol:DeployMocks --rpc-url http://127.0.0.1:8545 --broadcast",
  {
    cwd: join(repoRoot, "packages", "contracts"),
    stdio: "inherit",
    shell: useShell,
  },
);

const deployed = join(repoRoot, "packages", "contracts", "deployments", "31337.json");
const outDeployments = join(webDir, "out", "deployments");
mkdirSync(outDeployments, { recursive: true });
cpSync(deployed, join(outDeployments, "31337.json"));
console.log("[e2e] copied deployments to out/deployments/31337.json");

const serve = spawn("npx", ["--yes", "serve@14", "out", "-l", "3457"], {
  cwd: webDir,
  stdio: "inherit",
  shell: useShell,
});

serve.on("error", (err) => {
  console.error("[e2e] serve failed:", err.message);
  process.exit(1);
});

await waitPort(3457);
console.log("[e2e] static app on http://127.0.0.1:3457");

function shutdown() {
  try {
    anvil.kill("SIGTERM");
  } catch {
    /* ignore */
  }
  try {
    serve.kill("SIGTERM");
  } catch {
    /* ignore */
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await new Promise(() => {
  /* keep webServer alive for Playwright */
});
