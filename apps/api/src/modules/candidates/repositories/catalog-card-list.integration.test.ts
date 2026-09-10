import { normalizeNameForIdentity } from "@openrift/shared/utils";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbContext, seedTestUser } from "../../../test/integration-context.js";
import { candidateCardsRepo } from "./candidate-cards.js";

const ctx = createDbContext("a0000000-0051-4000-a000-000000000001");

describe.skipIf(!ctx)("catalog card list queries (integration)", () => {
  const { db } = ctx!;
  const repo = candidateCardsRepo(db);

  const TRUSTED = "cl51-trusted";
  const UNTRUSTED = "cl51-untrusted";
  const HIDDEN = "cl51-hidden";
  const IGNORED = "cl51-ignoredsrc";
  const PROVIDERS = [TRUSTED, UNTRUSTED, HIDDEN, IGNORED];

  const SET_FIRST = "51000051-0001-4000-a000-000000000001";
  const SET_LATER = "51000051-0002-4000-a000-000000000001";
  const SET_IDS = [SET_FIRST, SET_LATER];

  const CARD_ID = "ca000051-0001-4000-a000-000000000001";
  const CARD_NAME = "Catalog List Fixture";
  const CARD_NORM = normalizeNameForIdentity(CARD_NAME);
  const DRAFT_NAME = "Catalog List Orphan";
  const DRAFT_NORM = normalizeNameForIdentity(DRAFT_NAME);

  const P_FIRST = "b0000051-0001-4000-a000-000000000001";
  const P_INACTIVE = "b0000051-0002-4000-a000-000000000001";
  const P_LATER = "b0000051-0003-4000-a000-000000000001";
  const PRINTING_IDS = [P_FIRST, P_INACTIVE, P_LATER];

  const CC_TRUSTED = "cc000051-0001-4000-a000-000000000001";
  const CC_UNTRUSTED = "cc000051-0002-4000-a000-000000000001";
  const CC_HIDDEN = "cc000051-0003-4000-a000-000000000001";
  const CC_IGNORED = "cc000051-0004-4000-a000-000000000001";
  const CC_DRAFT = "cc000051-0005-4000-a000-000000000001";
  const CC_SYMBOL_A = "cc000051-0006-4000-a000-000000000001";
  const CC_SYMBOL_B = "cc000051-0007-4000-a000-000000000001";
  const CC_IDS = [
    CC_TRUSTED,
    CC_UNTRUSTED,
    CC_HIDDEN,
    CC_IGNORED,
    CC_DRAFT,
    CC_SYMBOL_A,
    CC_SYMBOL_B,
  ];

  const CP_NEW = "c0000051-0001-4000-a000-000000000001";
  const CP_IGNORED = "c0000051-0002-4000-a000-000000000001";
  const CP_UNTRUSTED = "c0000051-0003-4000-a000-000000000001";
  const CP_HIDDEN = "c0000051-0004-4000-a000-000000000001";
  const CP_IGNORED_CARD = "c0000051-0005-4000-a000-000000000001";
  const CP_DRAFT = "c0000051-0006-4000-a000-000000000001";
  const CP_IDS = [CP_NEW, CP_IGNORED, CP_UNTRUSTED, CP_HIDDEN, CP_IGNORED_CARD, CP_DRAFT];

  const SUB_UNTRUSTED = "5b000051-0001-4000-a000-000000000001";

  const CHECKED = new Date("2026-02-03T00:00:00Z");
  const FIRST_UPLOAD = new Date("2026-01-02T00:00:00Z");
  const LAST_WRITE = new Date("2026-05-06T00:00:00Z");

  let userId = "";
  const imageFileIds: string[] = [];

  function printing(id: string, setId: string, shortCode: string, language: string) {
    return {
      id,
      cardId: CARD_ID,
      setId,
      shortCode,
      publicCode: `${shortCode}/003`,
      rarity: "common",
      artVariant: "normal",
      isSigned: false,
      finish: "normal",
      size: "standard",
      language,
      artist: "A. Painter",
    };
  }

  function candidateCard(values: {
    id: string;
    provider: string;
    externalId: string;
    name?: string;
    checkedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    return {
      name: CARD_NAME,
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
    shortCode?: string;
    setId?: string;
    language?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    return { shortCode: "CL51A-001", printingId: null, ...values };
  }

  async function frontImage(printingId: string, isActive: boolean) {
    const file = await db
      .insertInto("imageFiles")
      .values({ rehostedUrl: `/media/cards/cl/${crypto.randomUUID()}` })
      .returning("id")
      .executeTakeFirstOrThrow();
    imageFileIds.push(file.id);
    await db
      .insertInto("printingImages")
      .values({ printingId, imageFileId: file.id, face: "front", isActive })
      .execute();
  }

  beforeAll(async () => {
    const user = await seedTestUser(db);
    userId = user.id;

    await db
      .insertInto("providerSettings")
      .values([
        {
          provider: TRUSTED,
          sortOrder: 1,
          isHidden: false,
          isFavorite: true,
          helperReviewable: true,
        },
        {
          provider: UNTRUSTED,
          sortOrder: 2,
          isHidden: false,
          isFavorite: false,
          helperReviewable: false,
        },
        {
          provider: HIDDEN,
          sortOrder: 3,
          isHidden: true,
          isFavorite: true,
          helperReviewable: false,
        },
        {
          provider: IGNORED,
          sortOrder: 4,
          isHidden: false,
          isFavorite: true,
          helperReviewable: false,
        },
      ])
      .execute();

    await db
      .insertInto("sets")
      .values([
        { id: SET_FIRST, slug: "CL51A", name: "Catalog List First", sortOrder: 9101 },
        { id: SET_LATER, slug: "CL51B", name: "Catalog List Later", sortOrder: 9102 },
      ])
      .execute();

    await db
      .insertInto("cards")
      .values({ id: CARD_ID, slug: "cl51-fixture", name: CARD_NAME, type: "unit" })
      .execute();

    await db
      .insertInto("printings")
      .values([
        printing(P_FIRST, SET_FIRST, "CL51A-001", "EN"),
        printing(P_INACTIVE, SET_FIRST, "CL51A-002", "FR"),
        printing(P_LATER, SET_LATER, "CL51B-001", "EN"),
      ])
      .execute();

    await frontImage(P_LATER, true);
    await frontImage(P_INACTIVE, false);

    await db
      .insertInto("candidateCards")
      .values([
        candidateCard({ id: CC_TRUSTED, provider: TRUSTED, externalId: "cl51-cc-trusted" }),
        candidateCard({
          id: CC_UNTRUSTED,
          provider: UNTRUSTED,
          externalId: "cl51-cc-untrusted",
          checkedAt: CHECKED,
          createdAt: FIRST_UPLOAD,
          updatedAt: LAST_WRITE,
        }),
        candidateCard({ id: CC_HIDDEN, provider: HIDDEN, externalId: "cl51-cc-hidden" }),
        candidateCard({ id: CC_IGNORED, provider: IGNORED, externalId: "cl51-cc-ignored" }),
        candidateCard({
          id: CC_DRAFT,
          provider: TRUSTED,
          externalId: "cl51-cc-draft",
          name: DRAFT_NAME,
        }),
        candidateCard({
          id: CC_SYMBOL_A,
          provider: TRUSTED,
          externalId: "cl51-cc-symbol-a",
          name: "!!!",
        }),
        candidateCard({
          id: CC_SYMBOL_B,
          provider: TRUSTED,
          externalId: "cl51-cc-symbol-b",
          name: "???",
        }),
      ])
      .execute();

    await db
      .insertInto("candidatePrintings")
      .values([
        candidatePrinting({
          id: CP_NEW,
          candidateCardId: CC_TRUSTED,
          externalId: "cl51-cp-new",
        }),
        candidatePrinting({
          id: CP_IGNORED,
          candidateCardId: CC_TRUSTED,
          externalId: "cl51-cp-ignored",
        }),
        candidatePrinting({
          id: CP_UNTRUSTED,
          candidateCardId: CC_UNTRUSTED,
          externalId: "cl51-cp-untrusted",
          createdAt: FIRST_UPLOAD,
          updatedAt: FIRST_UPLOAD,
        }),
        candidatePrinting({
          id: CP_HIDDEN,
          candidateCardId: CC_HIDDEN,
          externalId: "cl51-cp-hidden",
        }),
        candidatePrinting({
          id: CP_IGNORED_CARD,
          candidateCardId: CC_IGNORED,
          externalId: "cl51-cp-ignored-card",
        }),
        candidatePrinting({
          id: CP_DRAFT,
          candidateCardId: CC_DRAFT,
          externalId: "cl51-cp-draft",
          shortCode: "CL51A-900",
          setId: "CL51A",
          language: "FR",
        }),
      ])
      .execute();

    await db
      .insertInto("ignoredCandidateCards")
      .values({ provider: IGNORED, externalId: "cl51-cc-ignored" })
      .execute();

    await db
      .insertInto("ignoredCandidatePrintings")
      .values({ provider: TRUSTED, externalId: "cl51-cp-ignored", finish: null })
      .execute();

    await db
      .insertInto("cardSubmissions")
      .values({
        id: SUB_UNTRUSTED,
        userId: user.id,
        provider: UNTRUSTED,
        externalId: "cl51-cc-untrusted",
        candidateCardId: CC_UNTRUSTED,
        kind: "correction",
        cardName: CARD_NAME,
        cardSlug: null,
        note: null,
        proposedDiff: ["card.energy"],
      })
      .execute();
  });

  afterAll(async () => {
    await db.deleteFrom("cardSubmissions").where("id", "=", SUB_UNTRUSTED).execute();
    await db.deleteFrom("ignoredCandidatePrintings").where("provider", "in", PROVIDERS).execute();
    await db.deleteFrom("ignoredCandidateCards").where("provider", "in", PROVIDERS).execute();
    await db.deleteFrom("candidatePrintings").where("id", "in", CP_IDS).execute();
    await db.deleteFrom("candidateCards").where("id", "in", CC_IDS).execute();
    await db.deleteFrom("printingImages").where("printingId", "in", PRINTING_IDS).execute();
    await db.deleteFrom("imageFiles").where("id", "in", imageFileIds).execute();
    await db.deleteFrom("printings").where("id", "in", PRINTING_IDS).execute();
    await db.deleteFrom("cards").where("id", "=", CARD_ID).execute();
    await db.deleteFrom("sets").where("id", "in", SET_IDS).execute();
    await db.deleteFrom("providerSettings").where("provider", "in", PROVIDERS).execute();
    await db.deleteFrom("users").where("id", "=", userId).execute();
  });

  async function cardRow() {
    const rows = await repo.listCatalogCardRows(null);
    return rows.find((row) => row.cardSlug === "cl51-fixture");
  }

  describe("listCatalogCardRows", () => {
    it("names the first set by set sort order and lists every printing code", async () => {
      const row = await cardRow();

      expect(row).toMatchObject({
        name: CARD_NAME,
        normName: CARD_NORM,
        firstSetSlug: "CL51A",
        firstSetName: "Catalog List First",
        printingCount: 3,
      });
      expect(row?.setSlugs.toSorted()).toEqual(["CL51A", "CL51B"]);
      expect(row?.shortCodes.toSorted()).toEqual(["CL51A-001", "CL51A-002 [FR]", "CL51B-001"]);
    });

    it("counts a printing with no front image and one whose front image is inactive", async () => {
      const row = await cardRow();

      expect(row?.printingsWithoutImage).toBe(2);
    });

    it("counts new printings for the trusted source only, skipping the ignored one", async () => {
      const row = await cardRow();

      expect(row?.newPrintings).toBe(1);
    });

    it("lists only trusted, visible, non-ignored sources as unchecked", async () => {
      const row = await cardRow();

      expect(row?.uncheckedTrustedProviders).toEqual([TRUSTED]);
    });

    it("counts a pending submission from an untrusted source as a proposal", async () => {
      const row = await cardRow();

      expect(row?.proposals).toBe(1);
    });

    it("emits a draft row for a candidate name with no live card", async () => {
      const rows = await repo.listCatalogCardRows(null);
      const draft = rows.find((row) => row.normName === DRAFT_NORM);

      expect(draft).toMatchObject({
        cardSlug: null,
        name: DRAFT_NAME,
        firstSetSlug: null,
        firstSetName: null,
        printingCount: 0,
        printingsWithoutImage: 0,
        newPrintings: 1,
      });
      expect(draft?.setSlugs).toEqual(["CL51A"]);
      expect(draft?.shortCodes).toEqual(["CL51A-900 [FR]"]);
      expect(draft?.uncheckedTrustedProviders).toEqual([TRUSTED]);
    });

    it("keeps punctuation-only names as one draft row each", async () => {
      const rows = await repo.listCatalogCardRows(null);
      const symbols = rows.filter((row) => row.name === "!!!" || row.name === "???");

      expect(symbols.map((row) => row.name).toSorted()).toEqual(["!!!", "???"]);
      expect(symbols.every((row) => row.cardSlug === null && row.normName === "")).toBe(true);
    });

    it("drops the draft when the grant excludes its provider but keeps the live card", async () => {
      const rows = await repo.listCatalogCardRows([UNTRUSTED]);
      const row = rows.find((entry) => entry.cardSlug === "cl51-fixture");

      expect(rows.some((entry) => entry.normName === DRAFT_NORM)).toBe(false);
      expect(row).toMatchObject({
        printingCount: 3,
        newPrintings: 0,
        proposals: 1,
        uncheckedTrustedProviders: [],
      });
    });
  });

  describe("listCatalogSourceRows", () => {
    it("reports the settings, counts and ignored rows per provider", async () => {
      const rows = await repo.listCatalogSourceRows();
      const byProvider = new Map(rows.map((row) => [row.provider, row]));

      expect(byProvider.get(TRUSTED)).toMatchObject({
        rows: 4,
        printingRows: 2,
        isHidden: false,
        isFavorite: true,
        helperReviewable: true,
        sortOrder: 1,
        ignoredCount: 1,
      });
      expect(byProvider.get(IGNORED)).toMatchObject({ rows: 0, printingRows: 0, ignoredCount: 1 });
      expect(byProvider.get(HIDDEN)).toMatchObject({ isHidden: true, rows: 1 });
    });

    it("reports the last write, not the first upload, as the last uploaded time", async () => {
      const rows = await repo.listCatalogSourceRows();
      const row = rows.find((entry) => entry.provider === UNTRUSTED);

      expect(row?.lastUploadedAt?.toISOString()).toBe(LAST_WRITE.toISOString());
    });
  });
});
