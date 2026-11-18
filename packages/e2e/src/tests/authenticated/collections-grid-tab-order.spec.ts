import { expect, test } from "@playwright/test";

import { createVerifiedUser, loadDb } from "../../helpers/auth-otp.js";
import { API_BASE_URL, WEB_BASE_URL } from "../../helpers/constants.js";
import { deleteUser } from "../../helpers/db.js";
import { allGridPrintingIds, tabThroughGrid } from "../../helpers/grid-tab-order.js";

test.describe("collection grid keyboard order", () => {
  const email = `coll-tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;
  const password = "CollTabTest1!";

  test.afterAll(async () => {
    await deleteUser(email);
  });

  test("Tab walks every tile of a collection taller than the viewport before leaving it", async ({
    page,
  }) => {
    const sql = loadDb();
    let printingIds: string[];
    try {
      await createVerifiedUser(page.request, sql, email, password);
      const rows = await sql<{ id: string }[]>`SELECT id FROM printings ORDER BY id LIMIT 40`;
      printingIds = rows.map((row) => row.id);
    } finally {
      await sql.end();
    }
    const signIn = await page.request.post(`${API_BASE_URL}/api/auth/sign-in/email`, {
      headers: { Origin: WEB_BASE_URL },
      data: { email, password },
    });
    expect(signIn.ok()).toBeTruthy();
    const seeded = await page.request.post(`${API_BASE_URL}/api/v1/copies`, {
      data: { copies: printingIds.map((printingId) => ({ printingId })) },
    });
    expect(seeded.ok()).toBeTruthy();

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/collections");
    await page
      .locator("[data-index]:not([data-slot]) [data-printing-id]")
      .first()
      .waitFor({ state: "attached", timeout: 30_000 });

    const expected = await allGridPrintingIds(page);
    expect(expected.length).toBeGreaterThan(20);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(1440);

    const visited = await tabThroughGrid(page, expected[0] ?? "", expected.length * 6);

    expect(visited).toEqual(expected);
  });
});
