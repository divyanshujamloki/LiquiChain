import { existsSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const libStd = join(root, "lib", "forge-std", "src", "Test.sol");

if (!existsSync(libStd)) {
  console.log("[contracts] Installing forge-std…");
  mkdirSync(join(root, "lib"), { recursive: true });
  try {
    execSync("forge install foundry-rs/forge-std@v1.9.4 --no-commit", {
      cwd: root,
      stdio: "inherit",
    });
  } catch {
    console.warn(
      "[contracts] forge not found — skip forge-std install. Install Foundry: https://getfoundry.sh",
    );
  }
}
