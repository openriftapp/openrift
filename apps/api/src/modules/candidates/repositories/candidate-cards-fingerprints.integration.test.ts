import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDbContext,
  deletePrintingsById,
  insertCards,
  insertPrintings,
  seedTestUser,
} from "../../../test/integration-context.js";
import { candidateFingerprintsRepo } from "./candidate-cards-fingerprints.js";

const userId = crypto.randomUUID();
const setId = crypto.randomUUID();
const cardId = crypto.randomUUID();
const PRINTING = crypto.randomUUID();

const ctx = createDbContext(userId);

describe.skipIf(!ctx)("candidate fingerprint failures (integration)", () => {
  const { db } = ctx!;
  const repo = candidateFingerprintsRepo(db);
  const candidateCardIds: string[] = [];

  async function candidate(imageUrl: string): Promise<string> {
    const card = await db
      .insertInto("candidateCards")
      .values({
        provider: "cff-test",
        externalId: `cff-${crypto.randomUUID()}`,
        name: "Fingerprint Failure",
        normName: "fingerprintfailure",
        domains: [],
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    candidateCardIds.push(card.id);
    const row = await db
      .insertInto("candidatePrintings")
      .values({
        candidateCardId: card.id,
        printingId: PRINTING,
        shortCode: "CFF-001",
        externalId: `cff-p-${card.id}`,
        imageUrl,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    return row.id;
  }

  async function listedIds(): Promise<string[]> {
    const rows = await repo.listPrintingsNeedingFingerprint(100_000);
    return rows.map((row) => row.id);
  }

  beforeAll(async () => {
    await seedTestUser(db, { id: userId });
    await db
      .insertInto("sets")
      .values({ id: setId, slug: "CFF", name: "Fingerprint Failures", sortOrder: 9102 })
      .execute();
    await insertCards(db, {
      id: cardId,
      slug: "fingerprint-failure-card",
      name: "Fingerprint Failure Card",
    });
    await insertPrintings(db, {
      id: PRINTING,
      cardId,
      setId,
      shortCode: "CFF-001",
      publicCode: "CFF-001/001",
      rarity: "common",
      artVariant: "normal",
      isSigned: false,
      finish: "normal",
      size: "standard",
      language: "EN",
      artist: "A. Painter",
    });
  });

  afterAll(async () => {
    await db
      .deleteFrom("candidatePrintings")
      .where("candidateCardId", "in", candidateCardIds)
      .execute();
    await db.deleteFrom("candidateCards").where("id", "in", candidateCardIds).execute();
    await deletePrintingsById(db, [PRINTING]);
    await db.deleteFrom("cards").where("id", "=", cardId).execute();
    await db.deleteFrom("sets").where("id", "=", setId).execute();
    await db.deleteFrom("users").where("id", "=", userId).execute();
  });

  it("holds a failed URL back until its backoff passes", async () => {
    const url = `https://example.test/cff/${crypto.randomUUID()}.png`;
    const id = await candidate(url);
    expect(await listedIds()).toContain(id);

    expect(await repo.recordFingerprintFailure(id, url, "timeout")).toBe(1);
    expect(await listedIds()).not.toContain(id);

    await db
      .updateTable("candidateFingerprintFailures")
      .set({ lastAttemptAt: new Date(Date.now() - 2 * 60 * 60 * 1000) })
      .where("candidatePrintingId", "=", id)
      .execute();
    expect(await listedIds()).toContain(id);
  });

  it("counts attempts per URL and starts over when the URL changes", async () => {
    const url = `https://example.test/cff/${crypto.randomUUID()}.png`;
    const id = await candidate(url);
    await repo.recordFingerprintFailure(id, url, "timeout");
    expect(await repo.recordFingerprintFailure(id, url, "HTTP 503")).toBe(2);

    const replaced = `https://example.test/cff/${crypto.randomUUID()}.png`;
    await db
      .updateTable("candidatePrintings")
      .set({ imageUrl: replaced })
      .where("id", "=", id)
      .execute();
    expect(await listedIds()).toContain(id);
    expect(await repo.recordFingerprintFailure(id, replaced, "timeout")).toBe(1);
  });

  it("clears the failure once the URL is settled", async () => {
    const url = `https://example.test/cff/${crypto.randomUUID()}.png`;
    const id = await candidate(url);
    await repo.recordFingerprintFailure(id, url, "timeout");

    await repo.setImageFingerprint(id, url, "fp-cff");

    const failure = await db
      .selectFrom("candidateFingerprintFailures")
      .select("attempts")
      .where("candidatePrintingId", "=", id)
      .executeTakeFirst();
    expect(failure).toBeUndefined();
    expect(await listedIds()).not.toContain(id);
  });
});
