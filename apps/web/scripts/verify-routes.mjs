/**
 * Smoke-check exported static routes (run while `pnpm preview` or `npx serve out` is up).
 * Usage: node scripts/verify-routes.mjs http://127.0.0.1:3456
 */
const base = (process.argv[2] ?? "http://127.0.0.1:3456").replace(/\/$/, "");
const paths = [
  "/",
  "/login/",
  "/signup/",
  "/swap/",
  "/pool/new/",
  "/pool/demo/",
  "/logout/",
  "/404/",
];

let failed = false;
for (const p of paths) {
  const url = `${base}${p}`;
  try {
    const res = await fetch(url, { redirect: "manual" });
    if (!res.ok) {
      console.error(`FAIL ${p} -> ${res.status}`);
      failed = true;
    } else {
      console.log(`ok ${p} -> ${res.status}`);
    }
  } catch (e) {
    console.error(`FAIL ${p}`, e.message);
    failed = true;
  }
}

const badPool = await fetch(`${base}/pool/not-a-static-id/`, { redirect: "manual" });
if (badPool.status !== 404) {
  console.error(`FAIL unknown pool should 404, got ${badPool.status}`);
  failed = true;
} else {
  console.log("ok /pool/not-a-static-id/ -> 404");
}

process.exit(failed ? 1 : 0);
