import { readFileSync } from "node:fs";

import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { cardTile as cardTileFrame } from "../../helpers/catalog.js";
import type { E2eState } from "../../helpers/constants.js";
import { API_BASE_URL, STATE_FILE, WEB_BASE_URL } from "../../helpers/constants.js";
import { connectToDb, deleteUser, firstRow } from "../../helpers/db.js";
import { dndDrag, expectDropTargetArmed, moveDragTo, startDrag } from "../../helpers/dnd.js";
import { waitForHydrated } from "../../helpers/hydration.js";

type Sql = ReturnType<typeof connectToDb>;

function loadDb(): Sql {
  const state: E2eState = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  return connectToDb(state.tempDbUrl);
}

async function signUp(request: APIRequestContext, email: string, password: string) {
  const response = await request.post(`${API_BASE_URL}/api/auth/sign-up/email`, {
    headers: { Origin: WEB_BASE_URL },
    data: { email, password, name: "Drag Drop E2E" },
  });
  expect(response.ok()).toBeTruthy();
}

async function signIn(request: APIRequestContext, email: string, password: string) {
  const response = await request.post(`${API_BASE_URL}/api/auth/sign-in/email`, {
    headers: { Origin: WEB_BASE_URL },
    data: { email, password },
  });
  expect(response.ok()).toBeTruthy();
}

async function createAndLogin(page: Page, label: string): Promise<string> {
  const sql = loadDb();
  const email = `dnd-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;
  const password = "DragDropE2ePassword1!";
  try {
    await signUp(page.request, email, password);
    await sql`UPDATE users SET email_verified = true WHERE email = ${email}`;
  } finally {
    await sql.end();
  }
  await signIn(page.request, email, password);
  return email;
}

async function apiCreateCollection(page: Page, name: string): Promise<string> {
  const response = await page.request.post(`${API_BASE_URL}/api/v1/collections`, {
    headers: { Origin: WEB_BASE_URL },
    data: { name },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { id: string };
  return body.id;
}

async function getInboxId(email: string): Promise<string> {
  const sql = loadDb();
  try {
    const rows = (await sql`
      SELECT c.id FROM collections c
      JOIN users u ON u.id = c.user_id
      WHERE u.email = ${email} AND c.is_inbox = true
      LIMIT 1
    `) as { id: string }[];
    expect(rows.length).toBe(1);
    return firstRow(rows, `inbox for ${email}`).id;
  } finally {
    await sql.end();
  }
}

interface SeedResult {
  cardName: string;
  printingId: string;
}

/**
 * Picks the first card whose name is plain ASCII letters so the name works
 * as a stable Playwright locator (img[alt=...], text=...).
 */
async function seedSameCardCopies(
  email: string,
  collectionId: string,
  count: number,
): Promise<SeedResult> {
  const sql = loadDb();
  try {
    const picked = (await sql`
      SELECT p.printing_id, c.name AS card_name
      FROM printing_sides_ordered p
      JOIN cards c ON c.id = p.card_id
      WHERE c.name ~ '^[A-Za-z][A-Za-z ]*$'
      ORDER BY c.name, p.printing_id
      LIMIT 1
    `) as { printing_id: string; card_name: string }[];
    const { printing_id: printingId, card_name: cardName } = firstRow(
      picked,
      "suitable card for dnd seeding",
    );

    await sql`
      INSERT INTO copies (collection_id, printing_id)
      SELECT ${collectionId}::uuid, ${printingId}::uuid
      FROM users u
      CROSS JOIN generate_series(1, ${count}) g
      WHERE u.email = ${email}
    `;
    return { cardName, printingId };
  } finally {
    await sql.end();
  }
}

async function countCopiesInCollection(collectionId: string): Promise<number> {
  const sql = loadDb();
  try {
    const rows = (await sql`
      SELECT COUNT(*)::int AS count
      FROM copies
      WHERE collection_id = ${collectionId}
    `) as { count: number }[];
    return firstRow(rows, `copy count of ${collectionId}`).count;
  } finally {
    await sql.end();
  }
}

async function settledCardTile(page: Page, cardName: string): Promise<Locator> {
  const tile = cardTileFrame(page, cardName);
  await expect(tile).toBeVisible({ timeout: 15_000 });
  await waitForHydrated(tile);
  return tile;
}

/**
 * DroppableCollection wraps SidebarMenuItem (a <li>) in a <div>; the first div
 * ancestor of the link is that wrapper, where the drop ring class lands.
 */
function collectionRow(link: Locator): Locator {
  return link.locator("xpath=ancestor::div[1]");
}

function isMoveRequest(req: { method: () => string; url: () => string }): boolean {
  return req.method() === "POST" && req.url().endsWith("/api/v1/copies/move");
}

function watchMoveRequests(page: Page): { count: () => number } {
  let moves = 0;
  page.on("request", (req) => {
    if (isMoveRequest(req)) {
      moves += 1;
    }
  });
  return { count: () => moves };
}

/**
 * A drop that does move, after a drop that must not: any request from the earlier
 * drop is sent before this one, so the request count settles once this one answers.
 */
async function dropOntoTarget(page: Page, cardName: string) {
  const cardTile = await settledCardTile(page, cardName);
  const targetLink = page.getByRole("link", { name: "Target" });
  const moveResponse = page.waitForResponse(
    (response) => isMoveRequest(response.request()) && response.ok(),
  );
  await dndDrag(page, cardTile, targetLink, { dropRing: collectionRow(targetLink) });
  await moveResponse;
  await expect(page.getByText("Moved 1 card", { exact: true })).toBeVisible();
}

test.describe("collections drag-drop", () => {
  test.describe.serial("happy path", () => {
    let userEmail: string | undefined;

    test.afterEach(async () => {
      if (userEmail) {
        await deleteUser(userEmail);
        userEmail = undefined;
      }
    });

    test("drag a card from Inbox onto another collection moves it", async ({ page }) => {
      const email = await createAndLogin(page, "happy");
      userEmail = email;

      const targetId = await apiCreateCollection(page, "Target");
      const inboxId = await getInboxId(email);
      const { cardName } = await seedSameCardCopies(email, inboxId, 1);

      await page.goto(`/collections/${inboxId}`);
      await expect(page.getByRole("link", { name: "Inbox" })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("link", { name: "Target" })).toBeVisible();

      const cardTile = await settledCardTile(page, cardName);
      const targetLink = page.getByRole("link", { name: "Target" });

      const moveRequest = page.waitForRequest(isMoveRequest);
      await dndDrag(page, cardTile, targetLink, { dropRing: collectionRow(targetLink) });
      await moveRequest;

      await expect(page.getByText("Moved 1 card", { exact: true })).toBeVisible();
      await expect(page.getByRole("img", { name: cardName })).toHaveCount(0);

      await page.goto(`/collections/${targetId}`);
      await expect(page.getByRole("img", { name: cardName })).toBeVisible({ timeout: 15_000 });

      expect(await countCopiesInCollection(targetId)).toBe(1);
      expect(await countCopiesInCollection(inboxId)).toBe(0);
    });
  });

  test.describe.serial("multi-copy stack", () => {
    let userEmail: string | undefined;

    test.afterEach(async () => {
      if (userEmail) {
        await deleteUser(userEmail);
        userEmail = undefined;
      }
    });

    test("dragging a 3-copy stack moves 1 by default", async ({ page }) => {
      const email = await createAndLogin(page, "multi");
      userEmail = email;

      const targetId = await apiCreateCollection(page, "Target");
      const inboxId = await getInboxId(email);
      const { cardName } = await seedSameCardCopies(email, inboxId, 3);

      await page.goto(`/collections/${inboxId}`);
      await expect(page.getByRole("link", { name: "Target" })).toBeVisible({ timeout: 15_000 });

      const cardTile = await settledCardTile(page, cardName);
      const targetLink = page.getByRole("link", { name: "Target" });

      const moveRequest = page.waitForRequest(isMoveRequest);
      await dndDrag(page, cardTile, targetLink, { dropRing: collectionRow(targetLink) });
      await moveRequest;

      await expect(page.getByText("Moved 1 card", { exact: true })).toBeVisible();
      expect(await countCopiesInCollection(targetId)).toBe(1);
      expect(await countCopiesInCollection(inboxId)).toBe(2);
    });

    test("shift+drag on a 3-copy stack moves all 3 copies", async ({ page }) => {
      const email = await createAndLogin(page, "multi-shift");
      userEmail = email;

      const targetId = await apiCreateCollection(page, "Target");
      const inboxId = await getInboxId(email);
      const { cardName } = await seedSameCardCopies(email, inboxId, 3);

      await page.goto(`/collections/${inboxId}`);
      await expect(page.getByRole("link", { name: "Target" })).toBeVisible({ timeout: 15_000 });

      const cardTile = await settledCardTile(page, cardName);
      const targetLink = page.getByRole("link", { name: "Target" });

      // Press Shift before releasing so the collection DnD handler sees
      // shiftHeld=true at drop time and keeps every copy in the batch.
      const moveRequest = page.waitForRequest(isMoveRequest);
      await startDrag(page, cardTile);
      await moveDragTo(page, targetLink);
      await page.keyboard.down("Shift");
      await expect(page.getByText("3 copies").first()).toBeVisible();
      await expectDropTargetArmed(collectionRow(targetLink));
      await page.mouse.up();
      await page.keyboard.up("Shift");
      await moveRequest;

      await expect(page.getByText("Moved 3 cards", { exact: true })).toBeVisible();
      expect(await countCopiesInCollection(targetId)).toBe(3);
      expect(await countCopiesInCollection(inboxId)).toBe(0);
    });
  });

  test.describe.serial("drag overlay", () => {
    let userEmail: string | undefined;

    test.afterEach(async () => {
      if (userEmail) {
        await deleteUser(userEmail);
        userEmail = undefined;
      }
    });

    test("shows fanned preview + count badge during drag; release outside fires no request", async ({
      page,
    }) => {
      const email = await createAndLogin(page, "overlay");
      userEmail = email;

      const targetId = await apiCreateCollection(page, "Target");
      const inboxId = await getInboxId(email);
      const { cardName } = await seedSameCardCopies(email, inboxId, 2);

      await page.goto(`/collections/${inboxId}`);
      await expect(page.getByRole("link", { name: "Target" })).toBeVisible({ timeout: 15_000 });

      const cardTile = await settledCardTile(page, cardName);
      const start = await startDrag(page, cardTile);
      // Move further into empty grid space so the overlay is clear of the tile.
      await moveDragTo(page, { x: start.x + 200, y: start.y + 50 }, 10);
      // Without Shift the default drag represents only 1 copy.
      await page.keyboard.down("Shift");

      await expect(page.getByText("2 copies").first()).toBeVisible();

      // Source tile picks up inline opacity: 0.4 via DraggableCard's isDragging
      // state; walk up from the tile to find the ancestor carrying that style.
      const hasReducedOpacity = await cardTile.evaluate((el) => {
        let node: HTMLElement | null = el as HTMLElement;
        while (node) {
          if (node.style && node.style.opacity === "0.4") {
            return true;
          }
          node = node.parentElement;
        }
        return false;
      });
      expect(hasReducedOpacity).toBe(true);

      const moves = watchMoveRequests(page);
      await page.mouse.up();
      await page.keyboard.up("Shift");

      await dropOntoTarget(page, cardName);
      expect(moves.count()).toBe(1);
      await expect(page.getByText(/Moved \d+ card/u)).toHaveCount(1);
      expect(await countCopiesInCollection(targetId)).toBe(1);
      expect(await countCopiesInCollection(inboxId)).toBe(1);
    });
  });

  test.describe.serial("no-op: drop on source collection", () => {
    let userEmail: string | undefined;

    test.afterEach(async () => {
      if (userEmail) {
        await deleteUser(userEmail);
        userEmail = undefined;
      }
    });

    test("dropping on the source (Inbox) does not highlight, does not move", async ({ page }) => {
      const email = await createAndLogin(page, "src");
      userEmail = email;

      const targetId = await apiCreateCollection(page, "Target");
      const inboxId = await getInboxId(email);
      const { cardName } = await seedSameCardCopies(email, inboxId, 1);

      await page.goto(`/collections/${inboxId}`);
      await expect(page.getByRole("link", { name: "Inbox" })).toBeVisible({ timeout: 15_000 });

      const cardTile = await settledCardTile(page, cardName);
      const inboxLink = page.getByRole("link", { name: "Inbox" });
      const inboxRow = collectionRow(inboxLink);

      const moves = watchMoveRequests(page);

      const targetLink = page.getByRole("link", { name: "Target" });
      const targetRow = collectionRow(targetLink);

      await startDrag(page, cardTile);
      // Hovering Target first proves the drag resolves hover targets, so the
      // missing ring on Inbox below means Inbox refuses the drop.
      await moveDragTo(page, targetLink);
      await expectDropTargetArmed(targetRow);
      await moveDragTo(page, inboxLink, 10);
      await expect(targetRow).not.toHaveClass(/ring-primary/u);
      await expect(inboxRow).not.toHaveClass(/ring-primary/u);
      await page.mouse.up();

      await dropOntoTarget(page, cardName);
      expect(moves.count()).toBe(1);
      await expect(page.getByText(/Moved /u)).toHaveCount(1);
      expect(await countCopiesInCollection(targetId)).toBe(1);
      expect(await countCopiesInCollection(inboxId)).toBe(0);
    });
  });

  test.describe.serial("no-op: drop in empty space", () => {
    let userEmail: string | undefined;

    test.afterEach(async () => {
      if (userEmail) {
        await deleteUser(userEmail);
        userEmail = undefined;
      }
    });

    test("releasing outside any collection row fires no request", async ({ page }) => {
      const email = await createAndLogin(page, "empty");
      userEmail = email;

      const targetId = await apiCreateCollection(page, "Target");
      const inboxId = await getInboxId(email);
      const { cardName } = await seedSameCardCopies(email, inboxId, 1);

      await page.goto(`/collections/${inboxId}`);
      await expect(page.getByRole("link", { name: "Target" })).toBeVisible({ timeout: 15_000 });

      const cardTile = await settledCardTile(page, cardName);

      const moves = watchMoveRequests(page);

      const start = await startDrag(page, cardTile);
      // Release in grid whitespace, clear of sidebar and any card tile.
      await moveDragTo(page, { x: start.x + 400, y: start.y + 200 });
      await page.mouse.up();
      await expect(cardTile).toBeVisible();

      await dropOntoTarget(page, cardName);
      expect(moves.count()).toBe(1);
      await expect(page.getByText(/Moved /u)).toHaveCount(1);
      expect(await countCopiesInCollection(targetId)).toBe(1);
      expect(await countCopiesInCollection(inboxId)).toBe(0);
    });
  });

  test.describe.serial("hover highlight on target", () => {
    let userEmail: string | undefined;

    test.afterEach(async () => {
      if (userEmail) {
        await deleteUser(userEmail);
        userEmail = undefined;
      }
    });

    test("mid-drag, the Target row gets the ring highlight", async ({ page }) => {
      const email = await createAndLogin(page, "hover");
      userEmail = email;

      await apiCreateCollection(page, "Target");
      const inboxId = await getInboxId(email);
      const { cardName } = await seedSameCardCopies(email, inboxId, 1);

      await page.goto(`/collections/${inboxId}`);
      await expect(page.getByRole("link", { name: "Target" })).toBeVisible({ timeout: 15_000 });

      const cardTile = await settledCardTile(page, cardName);
      const targetLink = page.getByRole("link", { name: "Target" });
      const targetRow = collectionRow(targetLink);

      await startDrag(page, cardTile);
      await moveDragTo(page, targetLink);

      // The ring class is the actual visible drop affordance; there is no
      // role/aria alternative for a drag-hover state.
      await expect(targetRow).toHaveClass(/ring-primary/u);

      // Escape cancels the pointer drag, so no move outlives the test into the user teardown.
      await page.keyboard.press("Escape");
      await expect(targetRow).not.toHaveClass(/ring-primary/u);
    });
  });

  test.describe.serial("mobile: drag disabled", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    let userEmail: string | undefined;

    test.afterEach(async () => {
      if (userEmail) {
        await deleteUser(userEmail);
        userEmail = undefined;
      }
    });

    test("mouse-style drag does not fire a move request on mobile viewports", async ({ page }) => {
      const email = await createAndLogin(page, "mobile");
      userEmail = email;

      const targetId = await apiCreateCollection(page, "Target");
      const inboxId = await getInboxId(email);
      const { cardName } = await seedSameCardCopies(email, inboxId, 1);

      await page.goto(`/collections/${inboxId}`);
      const cardTile = await settledCardTile(page, cardName);

      const moves = watchMoveRequests(page);

      // On mobile, DraggableCard returns children without any dnd-kit listeners,
      // so pointer events never activate a drag regardless of where we move.
      const start = await startDrag(page, cardTile, { activates: false });
      await moveDragTo(page, { x: start.x + 200, y: start.y + 100 });
      await page.mouse.up();

      // Drag listeners follow the viewport, so a desktop-width drop is the real move.
      await page.setViewportSize({ width: 1280, height: 800 });
      await expect(page.getByRole("link", { name: "Target" })).toBeVisible({ timeout: 15_000 });
      await dropOntoTarget(page, cardName);
      expect(moves.count()).toBe(1);
      await expect(page.getByText(/Moved /u)).toHaveCount(1);
      expect(await countCopiesInCollection(targetId)).toBe(1);
      expect(await countCopiesInCollection(inboxId)).toBe(0);
    });
  });
});
