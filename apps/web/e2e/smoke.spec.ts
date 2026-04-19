import { test, expect } from "@playwright/test";

test.describe("static export UI smoke", () => {
  test("home shows brand and navigates to signup", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("LiquiChain").first()).toBeVisible();
    await page.getByRole("link", { name: "Get started" }).click();
    await expect(page).toHaveURL(/\/signup\/?$/);
    await expect(page.getByRole("heading", { name: /Create your access/i })).toBeVisible();
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/login/");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("button", { name: /Connect wallet/i })).toBeVisible();
  });

  test("swap page loads", async ({ page }) => {
    await page.goto("/swap/");
    await expect(page.getByRole("heading", { name: "Swap" })).toBeVisible();
  });

  test("pool new and liquidity routes load", async ({ page }) => {
    await page.goto("/pool/new/");
    await expect(page.getByRole("heading", { name: "Create pool" })).toBeVisible();
    await page.goto("/pool/demo/");
    await expect(page.getByRole("heading", { name: /Pool demo/i })).toBeVisible();
  });

  test("header navigation between swap and pool", async ({ page }) => {
    await page.goto("/swap/");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Liquidity" }).click();
    await expect(page).toHaveURL(/\/pool\/demo\/?$/);
  });
});
