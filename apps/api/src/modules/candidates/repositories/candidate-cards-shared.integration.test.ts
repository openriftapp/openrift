import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { SeededPrinting } from "../../../test/catalog-seed.js";
import { seedCatalogPrinting } from "../../../test/catalog-seed.js";
import { createDbContext, refreshCardAggregates } from "../../../test/integration-context.js";
import { candidateCardDetailRepo } from "./candidate-cards-detail.js";
import { candidateMatchingRepo } from "./candidate-cards-matching.js";
import { candidateReviewRepo } from "./candidate-cards-review.js";
import { cardSubmissionsRepo } from "./card-submissions.js";
import { workspaceBatchRepo } from "./workspace-batch.js";
import { workspaceQueueRepo } from "./workspace-queue.js";

const ctx = createDbContext(crypto.randomUUID());

const RUN = crypto.randomUUID().slice(0, 8);
const VISIBLE = `ccs-visible-${RUN}`;
const HIDDEN = `ccs-hidden-${RUN}`;
const IGNORED = `ccs-ignored-${RUN}`;
const ALIASED = `ccs-aliased-${RUN}`;
const PROVIDERS = [VISIBLE, HIDDEN, IGNORED, ALIASED];
const ALIAS_NORM = `ccsalias${RUN}`;
const NEW_NORM = `ccsbrandnew${RUN}`;

describe.skipIf(!ctx)("shared candidate filters (integration)", () => {
  const { db } = ctx!;
  const detail = candidateCardDetailRepo(db);
  const matching = candidateMatchingRepo(db);
  const queue = workspaceQueueRepo(db);
  const batch = workspaceBatchRepo(db);
  const review = candidateReviewRepo(db);
  const submissions = cardSubmissionsRepo(db);

  let live: SeededPrinting;
  let other: SeededPrinting;
  let ownsEmptyAlias = false;
  const ids = {
    visible: "",
    hidden: "",
    ignored: "",
    aliased: "",
    emptyName: "",
    brandNew: "",
    brandNewHidden: "",
    visibleLinked: "",
    visibleNew: "",
    visibleIgnoredNew: "",
    visibleIgnoredLinked: "",
    hiddenLinked: "",
    hiddenNew: "",
    ignoredNew: "",
  };

  async function candidateCard(provider: string, name: string, shortCode: string) {
    const row = await db
      .insertInto("candidateCards")
      .values({
        provider,
        externalId: `${provider}-${shortCode}`,
        name,
        normName: "",
        shortCode,
        domains: [],
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    return row.id;
  }

  async function candidatePrinting(
    candidateCardId: string,
    externalId: string,
    printingId: string | null,
    shortCode: string,
  ) {
    const row = await db
      .insertInto("candidatePrintings")
      .values({ candidateCardId, externalId, printingId, shortCode, finish: "normal" })
      .returning("id")
      .executeTakeFirstOrThrow();
    return row.id;
  }

  beforeAll(async () => {
    live = await seedCatalogPrinting(db, "ccs");
    other = await seedCatalogPrinting(db, "ccs");
    const liveShortCode = `${live.cardSlug}-001`;
    const otherShortCode = `${other.cardSlug}-001`;

    await db.insertInto("providerSettings").values({ provider: HIDDEN, isHidden: true }).execute();
    await db
      .insertInto("cardNameAliases")
      .values({ cardId: live.cardId, normName: ALIAS_NORM })
      .execute();
    const emptyAlias = await db
      .insertInto("cardNameAliases")
      .values({ cardId: live.cardId, normName: "" })
      .onConflict((oc) => oc.column("normName").doNothing())
      .returning("normName")
      .execute();
    ownsEmptyAlias = emptyAlias.length > 0;

    ids.visible = await candidateCard(VISIBLE, live.cardNormName, "CCS-1");
    ids.emptyName = await candidateCard(VISIBLE, "!!!", "CCS-2");
    ids.brandNew = await candidateCard(VISIBLE, NEW_NORM, "CCS-3");
    ids.hidden = await candidateCard(HIDDEN, live.cardNormName, "CCS-1");
    ids.brandNewHidden = await candidateCard(HIDDEN, `${NEW_NORM}hidden`, "CCS-3");
    ids.ignored = await candidateCard(IGNORED, live.cardNormName, "CCS-1");
    ids.aliased = await candidateCard(ALIASED, ALIAS_NORM, "CCS-1");
    await db
      .insertInto("ignoredCandidateCards")
      .values({ provider: IGNORED, externalId: `${IGNORED}-CCS-1` })
      .execute();

    ids.visibleLinked = await candidatePrinting(
      ids.visible,
      `${RUN}-visible-linked`,
      live.printingId,
      liveShortCode,
    );
    ids.visibleNew = await candidatePrinting(ids.visible, `${RUN}-visible-new`, null, "CCS-1");
    ids.visibleIgnoredNew = await candidatePrinting(
      ids.visible,
      `${RUN}-visible-ignored-new`,
      null,
      "CCS-1",
    );
    ids.visibleIgnoredLinked = await candidatePrinting(
      ids.visible,
      `${RUN}-visible-ignored-linked`,
      other.printingId,
      otherShortCode,
    );
    ids.hiddenLinked = await candidatePrinting(
      ids.hidden,
      `${RUN}-hidden-linked`,
      other.printingId,
      otherShortCode,
    );
    ids.hiddenNew = await candidatePrinting(ids.hidden, `${RUN}-hidden-new`, null, "CCS-1");
    ids.ignoredNew = await candidatePrinting(ids.ignored, `${RUN}-ignored-new`, null, "CCS-1");
    await db
      .insertInto("ignoredCandidatePrintings")
      .values([
        { provider: VISIBLE, externalId: `${RUN}-visible-ignored-new`, finish: null },
        { provider: VISIBLE, externalId: `${RUN}-visible-ignored-linked`, finish: "normal" },
      ])
      .execute();

    await refreshCardAggregates(db);
  });

  afterAll(async () => {
    const owned = db.selectFrom("candidateCards").select("id").where("provider", "in", PROVIDERS);
    await db.deleteFrom("candidatePrintings").where("candidateCardId", "in", owned).execute();
    await db.deleteFrom("candidateCards").where("provider", "in", PROVIDERS).execute();
    await db.deleteFrom("ignoredCandidateCards").where("provider", "in", PROVIDERS).execute();
    await db.deleteFrom("ignoredCandidatePrintings").where("provider", "in", PROVIDERS).execute();
    await db.deleteFrom("providerSettings").where("provider", "in", PROVIDERS).execute();
    await db.deleteFrom("cardNameAliases").where("normName", "=", ALIAS_NORM).execute();
    if (ownsEmptyAlias) {
      await db.deleteFrom("cardNameAliases").where("normName", "=", "").execute();
    }
    await live.cleanup();
    await other.cleanup();
  });

  it("keeps ignored cards and hidden sources out of both card checks", async () => {
    const matched = await matching.listUncheckedCandidateCardsWithLive("usersubmission", null, 1e6);
    const differences = await queue.uncheckedCardDifferences();

    for (const listed of [matched.map((row) => row.id), differences.map((row) => row.id)]) {
      expect(listed).toContain(ids.visible);
      expect(listed).not.toContain(ids.hidden);
      expect(listed).not.toContain(ids.ignored);
    }
    expect(differences.map((row) => row.id)).not.toContain(ids.emptyName);
  });

  it("keeps ignored printings and hidden sources out of both printing checks, compared alike", async () => {
    const matched = await matching.listUncheckedCandidatePrintingsWithLive(
      "usersubmission",
      null,
      1e6,
    );
    const queued = await queue.uncheckedLinkedPrintings();

    for (const listed of [matched.map((row) => row.id), queued.map((row) => row.id)]) {
      expect(listed).toContain(ids.visibleLinked);
      expect(listed).not.toContain(ids.visibleIgnoredLinked);
      expect(listed).not.toContain(ids.hiddenLinked);
    }
    const fromMatching = matched.find((row) => row.id === ids.visibleLinked)!;
    const fromQueue = queued.find((row) => row.id === ids.visibleLinked)!;
    expect(fromQueue.candidate).toEqual(fromMatching.candidate);
    expect(fromQueue.live).toEqual(fromMatching.live);
  });

  it("offers only unlinked printings of visible, unignored candidates for acceptance", async () => {
    const acceptable = await detail.acceptableCandidatePrintings([
      ids.visible,
      ids.hidden,
      ids.ignored,
    ]);
    const trusted = await batch.trustedNewPrintings(PROVIDERS);

    expect(acceptable.map((row) => row.id)).toEqual([ids.visibleNew]);
    expect(trusted.map((row) => row.id)).toEqual([ids.visibleNew]);
    expect(trusted[0]?.cardId).toBe(live.cardId);
  });

  it("never reads an empty name as a live card or a new card", async () => {
    const draftRows = await queue.newCardDrafts();
    const trustedRows = await batch.trustedNewCardDrafts(PROVIDERS);
    const drafts = draftRows.map((row) => row.id);
    const trustedDrafts = trustedRows.map((row) => row.id);

    expect(await submissions.liveCardByNormName("")).toBeNull();
    expect(await review.cardSlugsByNormNames(["", live.cardNormName])).toEqual([
      { normName: live.cardNormName, slug: live.cardSlug },
    ]);
    expect(drafts).toContain(ids.brandNew);
    expect(drafts).not.toContain(ids.emptyName);
    expect(drafts).not.toContain(ids.brandNewHidden);
    expect(drafts).not.toContain(ids.visible);
    expect(drafts).not.toContain(ids.aliased);
    expect(trustedDrafts).toEqual([ids.brandNew]);
  });

  it("resolves a name to its card by the card's own name first, then its aliases", async () => {
    expect(await submissions.liveCardByNormName(live.cardNormName)).toEqual({
      id: live.cardId,
      slug: live.cardSlug,
    });
    expect(await submissions.liveCardByNormName(ALIAS_NORM)).toEqual({
      id: live.cardId,
      slug: live.cardSlug,
    });
  });

  it("finds a card's candidate providers by its own name and its aliases, minus hidden and ignored", async () => {
    const providers = await detail.candidateProvidersForCard(live.cardId);

    expect(providers.toSorted()).toEqual([ALIASED, VISIBLE].toSorted());
  });
});
