import { spawnSync } from "node:child_process";

/**
 * True if `forge` resolves on PATH (Windows needs shell so .cmd shims work).
 */
export function hasFoundryOnPath(): boolean {
  const win = process.platform === "win32";
  const r = spawnSync("forge", ["--version"], {
    stdio: "ignore",
    shell: win,
  });
  if (r.status === 0) return true;
  if (win) {
    const r2 = spawnSync("forge.cmd", ["--version"], { stdio: "ignore", shell: true });
    return r2.status === 0;
  }
  return false;
}
