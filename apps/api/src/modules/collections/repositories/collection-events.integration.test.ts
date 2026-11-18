import { describe, expect, it } from "vitest";

import { buildKeysetCursor } from "../../../lib/keyset-cursor.js";
import { PRINTING_1 } from "../../../test/fixtures/constants.js";
import { createTestContext, req } from "../../../test/integration-context.js";
import { readJson } from "../../../test/read-json.js";
import { collectionEventsRepo } from "./collection-events.js";

const ctx = createTestContext("a0000000-0011-4000-a000-000000000001");

describe.skipIf(!ctx)("collectionEventsRepo via API (integration)", () => {
  const { app, db, userId } = ctx!;

  let collectionId: string;

  it("setup: creates a collection and adds copies to generate events", async () => {
    await app.fetch(req("GET", "/collections"));
    const colRes = await app.fetch(req("POST", "/collections", { name: "CE Repo Test" }));
    collectionId = ((await readJson(colRes)) as { id: string }).id;

    await app.fetch(
      req("POST", "/copies", {
        copies: [
          { printingId: PRINTING_1.id, collectionId },
          { printingId: PRINTING_1.id, collectionId },
        ],
      }),
    );
  });

  it("lists events newest-first with card details", async () => {
    const res = await app.fetch(req("GET", "/collection-events"));
    expect(res.status).toBe(200);

    const json = (await readJson(res)) as {
      items: { action: string; cardName: string; shortCode: string; rarity: string }[];
    };
    expect(json.items.length).toBeGreaterThanOrEqual(2);
    expect(json.items[0]!.cardName).toBeTypeOf("string");
    expect(json.items[0]!.shortCode).toBeTypeOf("string");
    expect(json.items[0]!.rarity).toBeTypeOf("string");
  });

  it("supports cursor-based pagination", async () => {
    const res = await app.fetch(req("GET", "/collection-events?limit=1"));
    expect(res.status).toBe(200);

    const json = (await readJson(res)) as { items: unknown[]; nextCursor: string | null };
    expect(json.items).toHaveLength(1);
    expect(json.nextCursor).not.toBeNull();
  });

  it("returns the rows after the cursor on the second page", async () => {
    const events = collectionEventsRepo(db);
    const all = await events.listForUser(userId, 10);
    const [first] = await events.listForUser(userId, 1);
    const secondPage = await events.listForUser(
      userId,
      1,
      buildKeysetCursor(first!.createdAt, first!.id),
    );

    expect(secondPage.map((row) => row.id)).toEqual(all.slice(1, 3).map((row) => row.id));
  });
});
