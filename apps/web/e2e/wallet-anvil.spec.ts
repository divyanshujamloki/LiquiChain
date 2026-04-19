import { test, expect } from "@playwright/test";
import { hasFoundryOnPath } from "./hasFoundry";

const ANVIL_RPC = "http://127.0.0.1:8545";
const hasFoundry = hasFoundryOnPath();

const suite = hasFoundry ? test.describe : test.describe.skip;

suite("wallet + chain (Anvil)", () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript((rpc: string) => {
      const chainIdHex = "0x7a69";
      window.ethereum = {
        isMetaMask: true,
        chainId: chainIdHex,
        on: () => undefined,
        removeListener: () => undefined,
        request: async (args: { method: string; params?: unknown[] }) => {
          const { method, params } = args;
          if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") {
            return null;
          }
          const body = {
            jsonrpc: "2.0",
            id: Date.now(),
            method,
            params: params ?? [],
          };
          const res = await fetch(rpc, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const json = (await res.json()) as { error?: { message?: string }; result?: unknown };
          if (json.error) {
            throw new Error(json.error.message ?? JSON.stringify(json.error));
          }
          return json.result;
        },
      };
    }, ANVIL_RPC);
  });

  test("connect injected wallet and read mock TKA balance on Swap", async ({ page }) => {
    await page.goto("/swap/");
    await expect(page.getByRole("heading", { name: "Swap" })).toBeVisible();

    await page.getByRole("banner").getByRole("button", { name: /Connect wallet/i }).click();

    await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 20_000 });

    await expect(page.getByText(/Test TKA balance/i)).toBeVisible();
    await expect(page.locator("text=/^1000000(\\.0+)? TKA$/")).toBeVisible({ timeout: 25_000 });
  });

  test("Sign in page: connect shows address in header", async ({ page }) => {
    await page.goto("/login/");
    await page.getByRole("main").getByRole("button", { name: /Connect wallet/i }).click();
    await expect(page.getByText(/0xf39F/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("Get started → signup: connect works", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Get started" }).click();
    await expect(page).toHaveURL(/\/signup\/?$/);
    await page.getByRole("banner").getByRole("button", { name: /Connect wallet/i }).click();
    await expect(page.getByText(/0xf39F/i)).toBeVisible({ timeout: 20_000 });
  });
});
