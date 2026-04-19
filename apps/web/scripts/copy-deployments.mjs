import { cpSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const src = join(root, "packages", "contracts", "deployments");
const dest = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "deployments");

if (!existsSync(src)) {
  console.warn("[web] no contracts deployments folder yet");
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log("[web] copied deployments to public/deployments");
