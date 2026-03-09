import { expect, test } from "@playwright/test";

test.describe("domain routing", () => {
  test("production apex is reachable", async ({ page }) => {
    const response = await page.goto("https://mentalhelp.chat", {
      waitUntil: "domcontentloaded",
    });

    expect(response).not.toBeNull();
    expect(response?.ok()).toBeTruthy();
    expect(page.url().startsWith("https://")).toBeTruthy();
  });

  test("www redirects to canonical apex", async ({ page }) => {
    await page.goto("https://www.mentalhelp.chat", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/https:\/\/mentalhelp\.chat\/?/);
  });

  test("dev UI host is reachable", async ({ page }) => {
    const response = await page.goto("https://dev.mentalhelp.chat", {
      waitUntil: "domcontentloaded",
    });

    expect(response).not.toBeNull();
    expect(response?.ok()).toBeTruthy();
    expect(page.url().startsWith("https://")).toBeTruthy();
  });

  test("http endpoints redirect to https", async ({ request }) => {
    const prodHttp = await request.get("http://mentalhelp.chat", { maxRedirects: 0 });
    expect([301, 302, 307, 308]).toContain(prodHttp.status());
    expect((prodHttp.headers()["location"] || "").startsWith("https://")).toBeTruthy();
  });
});
