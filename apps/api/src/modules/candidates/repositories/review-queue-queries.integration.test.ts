import { normalizeNameForIdentity } from "@openrift/shared/utils";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CARD_FURY_UNIT } from "../../../test/fixtures/constants.js";
import { createDbContext, seedTestUser } from "../../../test/integration-context.js";
import { candidateCardsRepo } from "./candidate-cards.js";
import { cardSubmissionsRepo } from "./card-submissions.js";

const ctx = createDbContext("a0000000-0050-4000-a000-000000000001");

describe.skipIf(!ctx)("review queue queries (integration)", () => {
  const { db } = ctx!;
  const candidateCards = candidateCardsRepo(db);
  const cardSubmissions = cardSubmissionsRepo(db);

  const PLAIN = "rq50-plain";
  const HIDDEN = "rq50-hidden";
  const IGNORED = "rq50-ignored";
  const CONTRIBUTOR = "rq50-contributor";
  const PROVIDERS = [PLAIN, HIDDEN, IGNORED, CONTRIBUTOR];

  const CC_PLAIN_A = "cc000050-0001-4000-a000-000000000001";
  const CC_PLAIN_B = "cc000050-0002-4000-a000-000000000001";
  const CC_HIDDEN = "cc000050-0003-4000-a000-000000000001";
  const CC_IGNORED = "cc000050-0004-4000-a000-000000000001";
  const CC_CHECKED = "cc000050-0005-4000-a000-000000000001";
  const CC_PENDING = "cc000050-0006-4000-a000-000000000001";
  const CC_SETTLED = "cc000050-0007-4000-a000-000000000001";
  const CC_IDS = [
    CC_PLAIN_A,
    CC_PLAIN_B,
    CC_HIDDEN,
    CC_IGNORED,
    CC_CHECKED,
    CC_PENDING,
    CC_SETTLED,
  ];

  const CP_PLAIN_A = "c0000050-0001-4000-a000-000000000001";
  const CP_PLAIN_B = "c0000050-0002-4000-a000-000000000001";
  const CP_CHECKED = "c0000050-0003-4000-a000-000000000001";
  const CP_PENDING = "c0000050-0004-4000-a000-000000000001";
  const CP_IDS = [CP_PLAIN_A, CP_PLAIN_B, CP_CHECKED, CP_PENDING];

  const SUB_PENDING = "5b000050-0001-4000-a000-000000000001";
  const SUB_SETTLED = "5b000050-0002-4000-a000-000000000001";
  const SUB_PURGED = "5b000050-0003-4000-a000-000000000001";

  const NORM_SHARED = "rqfiftyshared";
  const NORM_HIDDEN = "rqfiftyhidden";
  const NORM_IGNORED = "rqfiftyignored";
  const NORM_CHECKED = "rqfiftychecked";
  const NORM_PENDING = "rqfiftypending";
  const NORM_ALIAS = "rqfiftyalias";

  const CARD_NORM_NAME = normalizeNameForIdentity(CARD_FURY_UNIT.name);

  const OLDEST = new Date("2026-01-02T00:00:00Z");
  const NEWER = new Date("2026-03-04T00:00:00Z");

  let userId = "";

  function candidateCard(values: {
    id: string;
    provider: string;
    name: string;
    externalId: string;
    createdAt?: Date;
    checkedAt?: Date | null;
    submittedByUserId?: string;
  }) {
    return {
      types: ["unit"],
      superTypes: [],
      domains: ["fury"],
      might: null,
      energy: null,
      power: null,
      mightBonus: null,
      rulesText: null,
      effectText: null,
      tags: [],
      ...values,
    };
  }

  function candidatePrinting(values: {
    id: string;
    candidateCardId: string;
    externalId: string;
    checkedAt?: Date | null;
    printingId?: string | null;
  }) {
    return { shortCode: "RQ50-001", ...values };
  }

  beforeAll(async () => {
    const user = await seedTestUser(db);
    userId = user.id;

    await db
      .insertInto("providerSettings")
      .values(
        PROVIDERS.map((provider) => ({
          provider,
          sortOrder: 0,
          isHidden: provider === HIDDEN,
          isFavorite: false,
          helperReviewable: false,
        })),
      )
      .execute();

    await db
      .insertInto("candidateCards")
      .values([
        candidateCard({
          id: CC_PLAIN_A,
          provider: PLAIN,
          name: "RQ Fifty Shared",
          externalId: "rq50-plain-a",
          createdAt: OLDEST,
        }),
        candidateCard({
          id: CC_PLAIN_B,
          provider: PLAIN,
          name: "RQ Fifty Shared",
          externalId: "rq50-plain-b",
          createdAt: NEWER,
        }),
        candidateCard({
          id: CC_HIDDEN,
          provider: HIDDEN,
          name: "RQ Fifty Hidden",
          externalId: "rq50-hidden-a",
        }),
        candidateCard({
          id: CC_IGNORED,
          provider: IGNORED,
          name: "RQ Fifty Ignored",
          externalId: "rq50-ignored-a",
        }),
        candidateCard({
          id: CC_CHECKED,
          provider: PLAIN,
          name: "RQ Fifty Checked",
          externalId: "rq50-plain-checked",
          checkedAt: NEWER,
        }),
        candidateCard({
          id: CC_PENDING,
          provider: CONTRIBUTOR,
          name: "RQ Fifty Pending",
          externalId: "rq50-sub-pending",
          submittedByUserId: user.id,
        }),
        candidateCard({
          id: CC_SETTLED,
          provider: CONTRIBUTOR,
          name: "RQ Fifty Pending",
          externalId: "rq50-sub-settled",
          submittedByUserId: user.id,
        }),
      ])
      .execute();

    await db
      .insertInto("candidatePrintings")
      .values([
        candidatePrinting({
          id: CP_PLAIN_A,
          candidateCardId: CC_PLAIN_A,
          externalId: "rq50-cp-a",
        }),
        candidatePrinting({
          id: CP_PLAIN_B,
          candidateCardId: CC_PLAIN_B,
          externalId: "rq50-cp-b",
        }),
        candidatePrinting({
          id: CP_CHECKED,
          candidateCardId: CC_CHECKED,
          externalId: "rq50-cp-checked",
          checkedAt: NEWER,
          printingId: null,
        }),
        candidatePrinting({
          id: CP_PENDING,
          candidateCardId: CC_PENDING,
          externalId: "rq50-cp-pending",
        }),
      ])
      .execute();

    await db
      .insertInto("ignoredCandidateCards")
      .values({ provider: IGNORED, externalId: "rq50-ignored-a" })
      .execute();

    await db
      .insertInto("cardSubmissions")
      .values([
        {
          id: SUB_PENDING,
          userId: user.id,
          provider: CONTRIBUTOR,
          externalId: "rq50-sub-pending",
          candidateCardId: CC_PENDING,
          kind: "correction",
          cardName: "RQ Fifty Pending",
          cardSlug: null,
          note: "check the artist",
          proposedDiff: ["card.energy"],
        },
        {
          id: SUB_SETTLED,
          userId: user.id,
          provider: CONTRIBUTOR,
          externalId: "rq50-sub-settled",
          candidateCardId: CC_SETTLED,
          kind: "correction",
          cardName: "RQ Fifty Pending",
          cardSlug: null,
          note: null,
          proposedDiff: [],
          status: "not_applied",
          resolvedAt: NEWER,
        },
        {
          id: SUB_PURGED,
          userId: user.id,
          provider: CONTRIBUTOR,
          externalId: "rq50-sub-purged",
          candidateCardId: null,
          kind: "new_card",
          cardName: "RQ Fifty Purged",
          cardSlug: null,
          note: null,
          proposedDiff: ["card.new"],
        },
      ])
      .execute();

    await db
      .insertInto("cardNameAliases")
      .values({ normName: NORM_ALIAS, cardId: CARD_FURY_UNIT.id })
      .execute();
  });

  afterAll(async () => {
    await db
      .deleteFrom("cardSubmissions")
      .where("id", "in", [SUB_PENDING, SUB_SETTLED, SUB_PURGED])
      .execute();
    await db.deleteFrom("candidatePrintings").where("id", "in", CP_IDS).execute();
    await db.deleteFrom("candidateCards").where("id", "in", CC_IDS).execute();
    await db.deleteFrom("ignoredCandidateCards").where("provider", "=", IGNORED).execute();
    await db.deleteFrom("providerSettings").where("provider", "in", PROVIDERS).execute();
    await db.deleteFrom("cardNameAliases").where("normName", "=", NORM_ALIAS).execute();
    await db.deleteFrom("users").where("id", "=", userId).execute();
  });

  describe("listSourceReviewGroups", () => {
    it("counts an unfavorited provider and groups by provider and name", async () => {
      const groups = await candidateCards.listSourceReviewGroups(CONTRIBUTOR);
      const group = groups.find((row) => row.normName === NORM_SHARED);

      expect(group).toMatchObject({
        provider: PLAIN,
        uncheckedCards: 2,
        uncheckedPrintings: 2,
        newPrintings: 2,
        candidateCardId: CC_PLAIN_A,
        cardName: "RQ Fifty Shared",
      });
      expect(group?.createdAt.toISOString()).toBe(OLDEST.toISOString());
      expect(groups.filter((row) => row.normName === NORM_SHARED)).toHaveLength(1);
    });

    it("omits hidden providers, ignored candidates and fully checked cards", async () => {
      const groups = await candidateCards.listSourceReviewGroups(CONTRIBUTOR);
      const normNames = groups.map((row) => row.normName);

      expect(normNames).not.toContain(NORM_HIDDEN);
      expect(normNames).not.toContain(NORM_IGNORED);
      expect(normNames).not.toContain(NORM_CHECKED);
    });

    it("omits the excluded provider", async () => {
      const groups = await candidateCards.listSourceReviewGroups(CONTRIBUTOR);
      expect(groups.map((row) => row.provider)).not.toContain(CONTRIBUTOR);
    });
  });

  describe("pendingReviewQueueRows", () => {
    it("returns the pending row with its counts and submitter", async () => {
      const rows = await cardSubmissions.pendingReviewQueueRows();
      const row = rows.find((entry) => entry.id === SUB_PENDING);

      expect(row).toMatchObject({
        kind: "correction",
        provider: CONTRIBUTOR,
        cardName: "RQ Fifty Pending",
        normName: NORM_PENDING,
        candidateCardId: CC_PENDING,
        note: "check the artist",
        proposedDiff: ["card.energy"],
        uncheckedPrintings: 1,
        newPrintings: 1,
      });
      expect(row?.submitterName).not.toBeNull();
    });

    it("omits settled rows and rows whose staging was purged", async () => {
      const rows = await cardSubmissions.pendingReviewQueueRows();
      const ids = rows.map((row) => row.id);

      expect(ids).not.toContain(SUB_SETTLED);
      expect(ids).not.toContain(SUB_PURGED);
    });
  });

  describe("cardSlugsByNormNames", () => {
    it("resolves a direct norm name and an alias, and skips unknown names", async () => {
      const rows = await candidateCards.cardSlugsByNormNames([
        CARD_NORM_NAME,
        NORM_ALIAS,
        "rqfiftyunknown",
      ]);
      const bySlug = new Map(rows.map((row) => [row.normName, row.slug]));

      expect(bySlug.get(CARD_NORM_NAME)).toBe(CARD_FURY_UNIT.slug);
      expect(bySlug.get(NORM_ALIAS)).toBe(CARD_FURY_UNIT.slug);
      expect(bySlug.has("rqfiftyunknown")).toBe(false);
    });

    it("returns nothing for an empty input", async () => {
      expect(await candidateCards.cardSlugsByNormNames([])).toEqual([]);
    });
  });
});
