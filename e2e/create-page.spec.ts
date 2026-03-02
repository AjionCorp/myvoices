import { expect, test } from "@playwright/test";

test.describe("Create page UX", () => {
  test("shows core UI and updates preview/slug while typing", async ({ page }) => {
    await page.goto("/t/create");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByRole("heading", { name: "New topic" })).toBeVisible();
    await expect(page.getByText("Start a new community")).toBeVisible();
    await expect(page.getByText("Topic details")).toBeVisible();

    const titleInput = page.getByLabel("Title required");
    await titleInput.fill("Best Parkour Clips 2026");

    await expect(titleInput).toHaveValue("Best Parkour Clips 2026");
    await expect(page.getByRole("button", { name: "Sign in to Create" }).first()).toBeVisible();
  });

  test("switching category updates preview pill", async ({ page }) => {
    await page.goto("/t/create");
    await page.waitForLoadState("domcontentloaded");

    const categoryInput = page.locator("#topic-category");
    await categoryInput.fill("M");
    await categoryInput.fill("Music");
    await expect(categoryInput).toHaveValue("Music");
  });

  test("desktop shows inline CTA and no mobile sticky bar", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto("/t/create");

    const cta = page.getByRole("button", { name: "Sign in to Create" });
    await expect(cta.first()).toBeVisible();

    const ctaCount = await cta.count();
    expect(ctaCount).toBe(1);
  });

  test("mobile keeps sticky CTA visible in viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/t/create");

    const cta = page.getByRole("button", { name: "Sign in to Create" }).last();
    await expect(cta).toBeVisible();

    const box = await cta.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(848);
  });
});

