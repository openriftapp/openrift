import { readFileSync } from "node:fs";

import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { expect, test } from "../../fixtures/test.js";
import type { E2eState } from "../../helpers/constants.js";
import { API_BASE_URL, STATE_FILE, WEB_BASE_URL } from "../../helpers/constants.js";
import { connectToDb, firstRow } from "../../helpers/db.js";
import { dndDrag, dndDragToPoint } from "../../helpers/dnd.js";

type Sql = ReturnType<typeof connectToDb>;

function loadDb(): Sql {
  const state: E2eState = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  return connectToDb(state.tempDbUrl);
}

async function createDeckViaApi(
  request: APIRequestContext,
  { name, format }: { name: string; format: "constructed" | "freeform" },
): Promise<string> {
  const response = await request.post(`${API_BASE_URL}/api/v1/decks`, {
    headers: { Origin: WEB_BASE_URL },
    data: { name, format },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { id: string };
  return body.id;
}

async function seedDeckCards(
  request: APIRequestContext,
  deckId: string,
  cards: { cardId: string; zone: string; quantity: number }[],
): Promise<void> {
  const response = await request.put(`${API_BASE_URL}/api/v1/decks/${deckId}/cards`, {
    headers: { Origin: WEB_BASE_URL },
    data: { cards },
  });
  expect(response.ok()).toBeTruthy();
}

interface TestCard {
  id: string;
  name: string;
}

/** Plain-ASCII names keep the card name usable as a Playwright text locator without escaping. */
async function pickCardByType(type: string): Promise<TestCard> {
  const sql = loadDb();
  try {
    const rows = (await sql`
      SELECT id, name FROM cards
      WHERE (
          SELECT type_slug FROM card_card_types
          WHERE card_id = cards.id ORDER BY sort_order LIMIT 1
        ) = ${type}
        AND name ~ '^[A-Za-z][A-Za-z ]*$'
      ORDER BY name, id
      LIMIT 1
    `) as { id: string; name: string }[];
    return firstRow(rows, `suitable card of type '${type}'`);
  } finally {
    await sql.end();
  }
}

async function readDeckCards(
  deckId: string,
): Promise<{ cardId: string; zone: string; quantity: number }[]> {
  const sql = loadDb();
  try {
    const rows = (await sql`
      SELECT card_id AS "cardId", zone, quantity
      FROM deck_cards
      WHERE deck_id = ${deckId}
    `) as { cardId: string; zone: string; quantity: number }[];
    return rows;
  } finally {
    await sql.end();
  }
}

const ZONE_SLUGS: Record<string, string> = {
  Main: "main",
  Sideboard: "sideboard",
  Runes: "runes",
  Battlefield: "battlefield",
  Champion: "champion",
  Overflow: "overflow",
  Legend: "legend",
};

/**
 * The wrapper owning the drop ref and the ring highlight. Its header sits
 * inside an OrnamentRule, so walking up from the label button is not stable.
 */
function zoneSection(page: Page, label: string): Locator {
  return page.locator(`[data-slot="deck-zone"][data-zone="${ZONE_SLUGS[label] ?? label}"]`).first();
}

function zoneLabelButton(page: Page, label: string): Locator {
  return page.getByRole("button", { name: `Edit ${label}`, exact: true }).first();
}

/**
 * Events bubble to the draggable outer <div>, so the inner role=button works
 * for both click activation and pointer drag.
 */
function deckCardRow(section: Locator, cardName: string): Locator {
  return section.getByRole("button").filter({ hasText: cardName }).first();
}

/**
 * Non-draggable thumbnails also carry data-printing-id, so key off the
 * aria-roledescription dnd-kit only puts on the real drag wrapper.
 */
function browserCardTile(page: Page, cardName: string): Locator {
  return page
    .locator("[data-printing-id][aria-roledescription]")
    .filter({ has: page.getByRole("img", { name: cardName }) })
    .first();
}

/** The card browser renders a placeholder until a zone is active. */
async function activateZone(page: Page, label: string) {
  await zoneLabelButton(page, label).click();
}

async function searchBrowserFor(page: Page, cardName: string) {
  const searchInput = page.getByPlaceholder(/Search/u).first();
  await searchInput.fill(cardName);
  // Debounced search pushes to URL after 200ms; wait a touch longer.
  await expect(browserCardTile(page, cardName)).toBeVisible({ timeout: 10_000 });
}

async function dndDragWithShift(page: Page, source: Locator, target: Locator) {
  await dndDrag(page, source, target, { dropRing: target, shift: true });
}

/**
 * Every card edit records an undo step synchronously with the edit, before any
 * save is scheduled, so a disabled Undo after the drop means nothing changed.
 */
async function expectNoDeckEdit(page: Page) {
  const undo = page.getByRole("button", { name: "Undo", exact: true, includeHidden: true });
  await expect(undo.first()).toBeDisabled();
}

test.describe("deck editor zones + drag-drop", () => {
  test.describe("zone section structure", () => {
    test("renders each zone header and collapses Main Deck when its chevron is clicked", async ({
      authenticatedPage,
    }) => {
      const page = authenticatedPage;
      const unit = await pickCardByType("unit");
      const deckId = await createDeckViaApi(page.request, {
        name: `Zones Struct ${Date.now()}`,
        format: "constructed",
      });
      await seedDeckCards(page.request, deckId, [{ cardId: unit.id, zone: "main", quantity: 1 }]);

      await page.goto(`/decks/${deckId}`);
      await expect(page.getByText(/Constructed/u).first()).toBeVisible({ timeout: 15_000 });

      for (const label of [
        "Legend",
        "Champion",
        "Runes",
        "Battlefield",
        "Main",
        "Sideboard",
        "Overflow",
      ]) {
        await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
      }

      const mainSection = zoneSection(page, "Main");
      await expect(mainSection.getByText(unit.name, { exact: false })).toBeVisible();

      // The chevron's accessible name flips with the state it will move to.
      const chevron = mainSection.getByRole("button", { name: /(?:Collapse|Expand) Main/u });
      await chevron.click();
      await expect(mainSection.getByText(unit.name, { exact: false })).toBeHidden();
      await chevron.click();
      await expect(mainSection.getByText(unit.name, { exact: false })).toBeVisible();
    });

    test("clicking the section body sets the active zone so browser adds land there", async ({
      authenticatedPage,
    }) => {
      const page = authenticatedPage;
      const unit = await pickCardByType("unit");
      const deckId = await createDeckViaApi(page.request, {
        name: `Zones Activate ${Date.now()}`,
        format: "constructed",
      });

      await page.goto(`/decks/${deckId}`);
      await expect(page.getByText(/Constructed/u).first()).toBeVisible({ timeout: 15_000 });

      await activateZone(page, "Sideboard");
      await searchBrowserFor(page, unit.name);

      const addButton = browserCardTile(page, unit.name)
        .getByRole("button", { name: "Add to deck" })
        .first();
      await addButton.click();

      await expect
        .poll(
          async () => {
            const rows = await readDeckCards(deckId);
            return rows.find((row) => row.cardId === unit.id)?.zone ?? null;
          },
          { timeout: 10_000 },
        )
        .toBe("sideboard");
    });
  });

  test.describe("drag: browser-card → zone", () => {
    test("dragging a card tile onto Main Deck adds 1 copy", async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const unit = await pickCardByType("unit");
      const deckId = await createDeckViaApi(page.request, {
        name: `Drag Browser ${Date.now()}`,
        format: "constructed",
      });

      await page.goto(`/decks/${deckId}`);
      await expect(page.getByText(/Constructed/u).first()).toBeVisible({ timeout: 15_000 });

      await activateZone(page, "Main");
      await searchBrowserFor(page, unit.name);

      const tile = browserCardTile(page, unit.name);
      const mainSection = zoneSection(page, "Main");

      await dndDrag(page, tile, mainSection, { dropRing: mainSection });

      await expect
        .poll(
          async () => {
            const rows = await readDeckCards(deckId);
            return rows
              .filter((row) => row.cardId === unit.id && row.zone === "main")
              .reduce((sum, row) => sum + row.quantity, 0);
          },
          { timeout: 10_000 },
        )
        .toBe(1);

      await expect(mainSection.getByText(unit.name, { exact: false })).toBeVisible();
    });
  });

  test.describe("drag: browser-card → zone with Shift", () => {
    test("Shift-drag into Main Deck adds a 3-copy playset", async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const unit = await pickCardByType("unit");
      const deckId = await createDeckViaApi(page.request, {
        name: `Drag Shift Main ${Date.now()}`,
        format: "constructed",
      });

      await page.goto(`/decks/${deckId}`);
      await activateZone(page, "Main");
      await searchBrowserFor(page, unit.name);

      const tile = browserCardTile(page, unit.name);
      const mainSection = zoneSection(page, "Main");
      await dndDragWithShift(page, tile, mainSection);

      await expect
        .poll(
          async () => {
            const rows = await readDeckCards(deckId);
            return rows
              .filter((row) => row.cardId === unit.id && row.zone === "main")
              .reduce((sum, row) => sum + row.quantity, 0);
          },
          { timeout: 10_000 },
        )
        .toBe(3);
    });

    test("Shift-drag a rune into Runes fills toward the 12-card target", async ({
      authenticatedPage,
    }) => {
      const page = authenticatedPage;
      // At 720px Runes sits in dnd-kit's auto-scroll band of the sidebar, which
      // scrolls it out from under the pointer while the drop target is armed.
      await page.setViewportSize({ width: 1280, height: 1000 });
      const rune = await pickCardByType("rune");
      const deckId = await createDeckViaApi(page.request, {
        name: `Drag Shift Runes ${Date.now()}`,
        format: "freeform",
      });

      await page.goto(`/decks/${deckId}`);
      await activateZone(page, "Runes");
      await searchBrowserFor(page, rune.name);

      const tile = browserCardTile(page, rune.name);
      const runesSection = zoneSection(page, "Runes");
      await dndDragWithShift(page, tile, runesSection);

      // freeform avoids the constructed-only "missing Legend" failure that
      // would otherwise block the fill short of the 12-card target.
      await expect
        .poll(
          async () => {
            const rows = await readDeckCards(deckId);
            return rows
              .filter((row) => row.cardId === rune.id && row.zone === "runes")
              .reduce((sum, row) => sum + row.quantity, 0);
          },
          { timeout: 10_000 },
        )
        .toBe(12);
    });
  });

  test.describe("drag: deck-card → different zone", () => {
    test("without Shift moves one copy; with Shift moves all copies", async ({
      authenticatedPage,
    }) => {
      const page = authenticatedPage;
      // At 720px the sidebar's lower zones sit at the viewport edge, where the
      // drag auto-scrolls the sidebar and the drop lands on the next zone down.
      await page.setViewportSize({ width: 1280, height: 1000 });
      const unit = await pickCardByType("unit");

      const deckA = await createDeckViaApi(page.request, {
        name: `Drag Move One ${Date.now()}`,
        format: "freeform",
      });
      await seedDeckCards(page.request, deckA, [{ cardId: unit.id, zone: "main", quantity: 2 }]);

      await page.goto(`/decks/${deckA}`);
      const mainA = zoneSection(page, "Main");
      const sideboardA = zoneSection(page, "Sideboard");
      await expect(deckCardRow(mainA, unit.name)).toBeVisible({ timeout: 15_000 });

      await dndDrag(page, deckCardRow(mainA, unit.name), sideboardA, { dropRing: sideboardA });

      await expect
        .poll(
          async () => {
            const rows = await readDeckCards(deckA);
            const toMap = Object.fromEntries(
              rows.filter((row) => row.cardId === unit.id).map((row) => [row.zone, row.quantity]),
            );
            return toMap;
          },
          { timeout: 10_000 },
        )
        .toEqual({ main: 1, sideboard: 1 });

      const deckB = await createDeckViaApi(page.request, {
        name: `Drag Move All ${Date.now()}`,
        format: "freeform",
      });
      await seedDeckCards(page.request, deckB, [{ cardId: unit.id, zone: "main", quantity: 2 }]);

      await page.goto(`/decks/${deckB}`);
      const mainB = zoneSection(page, "Main");
      const overflowB = zoneSection(page, "Overflow");
      await expect(deckCardRow(mainB, unit.name)).toBeVisible({ timeout: 15_000 });

      await dndDragWithShift(page, deckCardRow(mainB, unit.name), overflowB);

      await expect
        .poll(
          async () => {
            const rows = await readDeckCards(deckB);
            const toMap = Object.fromEntries(
              rows.filter((row) => row.cardId === unit.id).map((row) => [row.zone, row.quantity]),
            );
            return toMap;
          },
          { timeout: 10_000 },
        )
        .toEqual({ overflow: 2 });
    });
  });

  test.describe("drag: deck-card → same zone", () => {
    test("dropping a row onto its own zone does not change quantities", async ({
      authenticatedPage,
    }) => {
      const page = authenticatedPage;
      const unit = await pickCardByType("unit");
      const deckId = await createDeckViaApi(page.request, {
        name: `Drag Same Zone ${Date.now()}`,
        format: "freeform",
      });
      await seedDeckCards(page.request, deckId, [{ cardId: unit.id, zone: "main", quantity: 2 }]);

      await page.goto(`/decks/${deckId}`);
      const main = zoneSection(page, "Main");
      await expect(deckCardRow(main, unit.name)).toBeVisible({ timeout: 15_000 });

      await dndDrag(page, deckCardRow(main, unit.name), main, { dropRing: main });

      await expectNoDeckEdit(page);
      const rows = await readDeckCards(deckId);
      expect(rows.filter((row) => row.cardId === unit.id)).toEqual([
        expect.objectContaining({ cardId: unit.id, zone: "main", quantity: 2 }),
      ]);
    });
  });

  test.describe("drag: deck-card → non-DRAG_ZONES", () => {
    test("dropping a Main Deck row onto Battlefields / Runes / Champion is a no-op", async ({
      authenticatedPage,
    }) => {
      const page = authenticatedPage;
      // At 720px Runes sits in the sidebar's auto-scroll band; see the Runes Shift-drag test.
      await page.setViewportSize({ width: 1280, height: 1000 });
      const unit = await pickCardByType("unit");
      const deckId = await createDeckViaApi(page.request, {
        name: `Drag Bad Zone ${Date.now()}`,
        format: "freeform",
      });
      await seedDeckCards(page.request, deckId, [{ cardId: unit.id, zone: "main", quantity: 2 }]);

      await page.goto(`/decks/${deckId}`);
      const main = zoneSection(page, "Main");
      await expect(deckCardRow(main, unit.name)).toBeVisible({ timeout: 15_000 });

      for (const label of ["Runes", "Battlefield", "Champion"]) {
        const target = zoneSection(page, label);
        await dndDrag(page, deckCardRow(main, unit.name), target, { rejectingZone: target });
      }

      await expectNoDeckEdit(page);
      const rows = await readDeckCards(deckId);
      expect(rows.filter((row) => row.cardId === unit.id)).toEqual([
        expect.objectContaining({ cardId: unit.id, zone: "main", quantity: 2 }),
      ]);
    });
  });

  test.describe("drag: deck-card → outside any zone", () => {
    test("releasing outside the sidebar decrements the row; with Shift removes the row", async ({
      authenticatedPage,
    }) => {
      const page = authenticatedPage;
      const unit = await pickCardByType("unit");

      const deckA = await createDeckViaApi(page.request, {
        name: `Drag Out Dec ${Date.now()}`,
        format: "freeform",
      });
      await seedDeckCards(page.request, deckA, [{ cardId: unit.id, zone: "main", quantity: 2 }]);

      await page.goto(`/decks/${deckA}`);
      const mainA = zoneSection(page, "Main");
      await expect(deckCardRow(mainA, unit.name)).toBeVisible({ timeout: 15_000 });

      const viewport = page.viewportSize();
      if (!viewport) {
        throw new Error("viewport size unavailable");
      }
      // Release well clear of the left-hand sidebar (the zones panel).
      const dropX = Math.min(viewport.width - 80, viewport.width / 2 + 200);
      const dropY = viewport.height / 2;

      await dndDragToPoint(page, deckCardRow(mainA, unit.name), { x: dropX, y: dropY });

      await expect
        .poll(
          async () => {
            const rows = await readDeckCards(deckA);
            return rows
              .filter((row) => row.cardId === unit.id && row.zone === "main")
              .reduce((sum, row) => sum + row.quantity, 0);
          },
          { timeout: 10_000 },
        )
        .toBe(1);

      const deckB = await createDeckViaApi(page.request, {
        name: `Drag Out Zero ${Date.now()}`,
        format: "freeform",
      });
      await seedDeckCards(page.request, deckB, [{ cardId: unit.id, zone: "main", quantity: 2 }]);

      await page.goto(`/decks/${deckB}`);
      const mainB = zoneSection(page, "Main");
      const rowB = deckCardRow(mainB, unit.name);
      await expect(rowB).toBeVisible({ timeout: 15_000 });

      await dndDragToPoint(page, rowB, { x: dropX, y: dropY }, { shift: true });

      await expect
        .poll(
          async () => {
            const rows = await readDeckCards(deckB);
            return rows.filter((row) => row.cardId === unit.id).length;
          },
          { timeout: 10_000 },
        )
        .toBe(0);
    });
  });

  test.describe("drop highlight during drag", () => {
    test("mid-drag, the Main Deck section gets the ring highlight", async ({
      authenticatedPage,
    }) => {
      const page = authenticatedPage;
      const unit = await pickCardByType("unit");
      const deckId = await createDeckViaApi(page.request, {
        name: `Drop Highlight ${Date.now()}`,
        format: "constructed",
      });

      await page.goto(`/decks/${deckId}`);
      await activateZone(page, "Main");
      await searchBrowserFor(page, unit.name);

      const tile = browserCardTile(page, unit.name);
      const mainSection = zoneSection(page, "Main");

      // ring-primary is the visible drop affordance; no role/aria alternative.
      await dndDrag(page, tile, mainSection, { dropRing: mainSection });
    });
  });

  test.describe("mobile", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("desktop-style drag of a deck row does not fire a mutation on mobile", async ({
      authenticatedPage,
    }) => {
      const page = authenticatedPage;
      const unit = await pickCardByType("unit");
      const deckId = await createDeckViaApi(page.request, {
        name: `Mobile Drag ${Date.now()}`,
        format: "freeform",
      });
      await seedDeckCards(page.request, deckId, [{ cardId: unit.id, zone: "main", quantity: 2 }]);

      await page.goto(`/decks/${deckId}`);

      // Without an active zone the mobile <h1> renders the literal "Zones";
      // tapping it opens the zones drawer.
      const mobileTitle = page.getByRole("button", { name: /^Zones/u }).first();
      await expect(mobileTitle).toBeVisible({ timeout: 15_000 });
      await mobileTitle.click();
      await expect(page.getByRole("heading", { name: "Deck Zones" })).toBeVisible();

      const main = zoneSection(page, "Main");
      const sideboard = zoneSection(page, "Sideboard");
      const row = deckCardRow(main, unit.name);
      await expect(row).toBeVisible();

      // DeckCardRow disables dnd-kit listeners on mobile; pointer events never
      // activate a drag.
      await dndDrag(page, row, sideboard, { activates: false });
      await expectNoDeckEdit(page);

      const deckRows = await readDeckCards(deckId);
      expect(deckRows.filter((deckRow) => deckRow.cardId === unit.id)).toEqual([
        expect.objectContaining({ cardId: unit.id, zone: "main", quantity: 2 }),
      ]);
    });
  });
});
