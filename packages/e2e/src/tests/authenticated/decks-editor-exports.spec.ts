import type { APIRequestContext, Page } from "@playwright/test";

import { expect, test } from "../../fixtures/test.js";
import { isApiPath } from "../../helpers/api-endpoint.js";
import { API_BASE_URL, WEB_BASE_URL } from "../../helpers/constants.js";
import { isServerFn } from "../../helpers/server-fn.js";

const ANNIE_CARD_ID = "019cfc3b-038a-7c0c-a76c-e0a5e2f46b18";

interface DeckCardSeed {
  cardId: string;
  zone: "main" | "champion" | "legend" | "runes" | "battlefield" | "sideboard" | "overflow";
  quantity: number;
}

async function createDeckViaApi(
  request: APIRequestContext,
  { name, format = "constructed" }: { name: string; format?: "constructed" | "freeform" },
): Promise<string> {
  const response = await request.post(`${API_BASE_URL}/api/v1/decks`, {
    headers: { Origin: WEB_BASE_URL },
    data: { name, format },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { id: string };
  return body.id;
}

async function setDeckCardsViaApi(
  request: APIRequestContext,
  deckId: string,
  cards: DeckCardSeed[],
) {
  const response = await request.put(`${API_BASE_URL}/api/v1/decks/${deckId}/cards`, {
    headers: { Origin: WEB_BASE_URL },
    data: { cards },
  });
  expect(response.ok()).toBeTruthy();
}

async function grantClipboard(page: Page) {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
}

/**
 * Scoped to main: the global header's user menu is also aria-haspopup="menu"
 * and comes first in DOM order.
 */
function kebabTrigger(page: Page) {
  return page.locator("main").locator('button[aria-haspopup="menu"]').first();
}

async function copyFromMenu(page: Page, entry: string) {
  await kebabTrigger(page).click();
  const encodeRequest = page.waitForRequest((request) =>
    isServerFn(request.url(), "encodeDeckCardsFn"),
  );
  await page.getByRole("menuitem", { name: entry, exact: true }).click();
  await encodeRequest;
}

async function openPrintDialog(page: Page, entry: "Proxies…" | "Registration sheet…") {
  await kebabTrigger(page).click();
  await page.getByRole("menuitem", { name: entry }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", {
      name: entry === "Proxies…" ? "Print proxies" : "Print registration sheet",
    }),
  ).toBeVisible();
  return dialog;
}

function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

test.describe("deck editor exports", () => {
  test.describe("copy as", () => {
    for (const { entry, toast } of [
      { entry: "Text list", toast: "Text list copied" },
      { entry: "Deck code", toast: "Deck code copied" },
      { entry: "Tabletop Simulator codes", toast: "Tabletop Simulator codes copied" },
    ] as const) {
      test(`${entry} puts the deck on the clipboard in one click`, async ({
        authenticatedPage,
      }) => {
        const page = authenticatedPage;
        await grantClipboard(page);
        const deckId = await createDeckViaApi(page.request, {
          name: `Copy ${entry} ${Date.now()}`,
        });
        await setDeckCardsViaApi(page.request, deckId, [
          { cardId: ANNIE_CARD_ID, zone: "main", quantity: 3 },
        ]);
        await page.goto(`/decks/${deckId}`);

        await copyFromMenu(page, entry);

        await expect(page.getByText(toast)).toBeVisible({ timeout: 15_000 });
        const clipboard = await readClipboard(page);
        expect(clipboard.length).toBeGreaterThan(0);
      });
    }

    test("copies the live draft, unsaved cards included", async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      await grantClipboard(page);
      const deckId = await createDeckViaApi(page.request, {
        name: `Copy Dirty ${Date.now()}`,
      });
      await page.goto(`/decks/${deckId}`);

      await page.route(
        (url) => isApiPath(url, "/api/v1/decks/{id}/cards"),
        (route) => route.abort(),
      );

      await page.getByRole("button", { name: "Edit Main", exact: true }).first().click();
      await page.getByPlaceholder(/search/iu).fill("Annie, Fiery");
      // Scope to the card tile: the sidebar adds a duplicate "Add to deck"
      // button once the optimistic update lands.
      const annieTile = page
        .locator("[data-printing-id]")
        .filter({ has: page.getByRole("img", { name: "Annie, Fiery" }) })
        .first();
      await expect(annieTile).toBeVisible({ timeout: 15_000 });
      await annieTile.getByRole("button", { name: "Add to deck" }).click();
      await expect(page.getByText("1/39", { exact: true }).first()).toBeVisible({
        timeout: 5000,
      });

      await copyFromMenu(page, "Text list");

      await expect(page.getByText("Text list copied")).toBeVisible({ timeout: 15_000 });
      expect(await readClipboard(page)).toContain("Annie, Fiery");
    });
  });

  test.describe("deck print: registration sheet", () => {
    test("renders form fields pre-filled from deck and session, no export request fires", async ({
      authenticatedPage,
    }) => {
      const page = authenticatedPage;
      const stamp = Date.now();
      const deckName = `Regform ${stamp}`;
      const deckId = await createDeckViaApi(page.request, { name: deckName });
      await setDeckCardsViaApi(page.request, deckId, [
        { cardId: ANNIE_CARD_ID, zone: "main", quantity: 3 },
      ]);
      await page.goto(`/decks/${deckId}`);

      const exportRequests: string[] = [];
      page.on("request", (request) => {
        if (
          isServerFn(request.url(), "exportDeckFn") ||
          isServerFn(request.url(), "encodeDeckCardsFn")
        ) {
          exportRequests.push(request.url());
        }
      });

      const dialog = await openPrintDialog(page, "Registration sheet…");

      await expect(dialog.getByLabel("Deck Name")).toHaveValue(deckName);
      // E2E user's display name is "E2E User"; the component splits on whitespace.
      await expect(dialog.getByLabel("First Name")).toHaveValue("E2E");
      await expect(dialog.getByLabel("Last Name")).toHaveValue("User");

      await dialog.getByLabel("Riot ID").fill("Tester#TAG");
      await dialog.getByLabel("Event Name").fill("E2E Open");
      await dialog.getByLabel("Event Location").fill("Testville");
      await dialog.getByLabel("Deck Designer").fill("E2E Tester");
      await dialog.getByPlaceholder("YYYY-MM-DD").fill("2026-05-01");

      await expect(dialog.getByLabel("Page size")).toContainText("A4");

      const downloadButton = dialog.getByRole("button", { name: "Download PDF" });
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 30_000 }),
        downloadButton.click(),
      ]);
      expect(download.suggestedFilename()).toBe(`regform-${stamp}-registration.pdf`);
      await expect(downloadButton).toBeEnabled();

      // Registration builds its PDF from the in-memory draft; the window spans
      // the whole flow up to the finished download.
      expect(exportRequests).toEqual([]);
    });
  });

  test.describe("empty deck", () => {
    test("disables every output of a deck with no cards", async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const deckId = await createDeckViaApi(page.request, { name: `Empty ${Date.now()}` });
      await page.goto(`/decks/${deckId}`);

      await kebabTrigger(page).click();
      for (const entry of ["Text list", "Deck code", "Proxies…", "Registration sheet…"]) {
        await expect(page.getByRole("menuitem", { name: entry, exact: true })).toHaveAttribute(
          "aria-disabled",
          "true",
        );
      }
      await expect(page.getByRole("menuitem", { name: /Compare/u })).not.toHaveAttribute(
        "aria-disabled",
        "true",
      );
    });
  });

  test.describe("proxy print: opening", () => {
    test("Proxies opens with the default render mode and page size", async ({
      authenticatedPage,
    }) => {
      const page = authenticatedPage;
      const deckId = await createDeckViaApi(page.request, { name: `Proxy Open ${Date.now()}` });
      await setDeckCardsViaApi(page.request, deckId, [
        { cardId: ANNIE_CARD_ID, zone: "main", quantity: 3 },
      ]);
      await page.goto(`/decks/${deckId}`);

      const dialog = await openPrintDialog(page, "Proxies…");
      await expect(dialog.getByRole("tab")).toHaveCount(0);

      const renderModeTrigger = dialog.getByLabel("Render mode");
      const pageSizeTrigger = dialog.getByLabel("Page size");
      await expect(renderModeTrigger).toContainText("Card images");
      await expect(pageSizeTrigger).toContainText("A4");

      await renderModeTrigger.click();
      await expect(page.getByRole("option", { name: "Text placeholders" })).toBeVisible();
      await expect(page.getByRole("option", { name: "Card images" })).toBeVisible();
      await page.keyboard.press("Escape");
    });
  });

  test.describe("proxy print: generation", () => {
    test("clicking Generate disables the button while work is in flight", async ({
      authenticatedPage,
    }) => {
      const page = authenticatedPage;
      const stamp = Date.now();
      const deckId = await createDeckViaApi(page.request, { name: `Proxy Gen ${stamp}` });
      await setDeckCardsViaApi(page.request, deckId, [
        { cardId: ANNIE_CARD_ID, zone: "main", quantity: 3 },
      ]);
      await page.goto(`/decks/${deckId}`);

      const dialog = await openPrintDialog(page, "Proxies…");

      /**
       * Card images are held until the in-flight state is asserted, so the
       * generation cannot finish first.
       */
      let releaseImages = () => {};
      const imagesReleased = new Promise<void>((resolve) => {
        releaseImages = resolve;
      });
      await page.route("**/media/cards/**", async (route) => {
        await imagesReleased;
        await route.continue();
      });

      const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
      await dialog.getByRole("button", { name: "Generate PDF" }).click();

      const busyButton = dialog.getByRole("button", { name: /Generating|Rendering/u });
      await expect(busyButton).toBeDisabled();
      await expect(busyButton).toHaveAttribute("aria-busy", "true");
      releaseImages();

      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe(`proxy-gen-${stamp}-proxies.pdf`);
      // A finished generation closes the dialog; a failed one leaves it open.
      await expect(dialog).toBeHidden();
    });
  });

  test.describe("phone menu", () => {
    test("opens Manage submenus in place and keeps the link in the menu", async ({
      authenticatedPage,
    }) => {
      const page = authenticatedPage;
      await page.setViewportSize({ width: 390, height: 844 });
      const deckId = await createDeckViaApi(page.request, { name: `Mobile Actions ${Date.now()}` });
      await setDeckCardsViaApi(page.request, deckId, [
        { cardId: ANNIE_CARD_ID, zone: "main", quantity: 3 },
      ]);
      await page.goto(`/decks/${deckId}`);

      // The bar's Share link button sits behind `hidden md:flex`.
      await expect(page.getByRole("button", { name: "Share link", exact: true })).toHaveCount(0);

      await kebabTrigger(page).click();
      await expect(page.getByRole("menuitem", { name: "Link & QR…" })).toBeVisible();
      await page.getByRole("menuitem", { name: "Details" }).click();
      await expect(page.getByRole("menuitem", { name: "Back" })).toBeVisible();
      await expect(page.getByRole("menuitem", { name: "Name & description" })).toBeVisible();
      await expect(page.getByRole("menuitem", { name: "Link & QR…" })).toHaveCount(0);
      await page.getByRole("menuitem", { name: "Back" }).click();
      await expect(page.getByRole("menuitem", { name: "Link & QR…" })).toBeVisible();
      await page.keyboard.press("Escape");

      await openPrintDialog(page, "Proxies…");
    });
  });
});
