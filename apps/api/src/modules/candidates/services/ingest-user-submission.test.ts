import type { CardSubmissionInput } from "@openrift/shared/contracts/card-submissions";
import { describe, expect, it, vi } from "vitest";

import type { Transact } from "../../../deps.js";
import {
  buildUserSubmissionCard,
  inferSubmissionKind,
  ingestUserSubmission,
  submissionStamp,
} from "./ingest-user-submission.js";

const USER_ID = "11111111-2222-3333-4444-555555555555";
const STAMP = "20260702-0900";
const CARD_ID = "card-uuid";
const BASE_ID = "0199a000-0000-7000-8000-000000000001";
const PROMO_ID = "0199a000-0000-7000-8000-000000000002";
const PAIR_ID = "0199a000-0000-7000-8000-000000000003";
const OTHER_CARD_PRINTING_ID = "0199a000-0000-7000-8000-000000000004";

function submission(overrides: Partial<CardSubmissionInput> = {}): CardSubmissionInput {
  return {
    slug: "ahri-alluring",
    card: {
      name: "Ahri, Alluring",
      types: ["unit"],
      super_types: ["champion"],
      domains: ["calm"],
      might: 4,
      energy: 5,
      power: 1,
      might_bonus: null,
      tags: ["Ahri"],
    },
    printings: [
      {
        public_code: "OGN-066/298",
        set_id: "ogn",
        set_name: "Origins",
        rarity: "rare",
        finish: "foil",
        language: "EN",
        printed_name: "Ahri, Alluring",
      },
    ],
    submissionNote: null,
    ...overrides,
  };
}

describe("submissionStamp", () => {
  it("gives two submissions in the same minute different card keys", () => {
    const now = new Date("2026-07-02T09:00:30Z");
    const first = submissionStamp(now);
    const second = submissionStamp(now);

    expect(first.startsWith("20260702-0900-")).toBe(true);
    expect(first).not.toBe(second);
  });
});

describe("buildUserSubmissionCard", () => {
  it("mints the card external_id as <slug>--<dateStamp>--<userId>", () => {
    const card = buildUserSubmissionCard(submission(), USER_ID, STAMP);
    expect(card.external_id).toBe(`ahri-alluring--${STAMP}--${USER_ID}`);
  });

  it("maps the contribution card fields and nulls the card-level rules/short_code", () => {
    const card = buildUserSubmissionCard(submission(), USER_ID, STAMP);
    expect(card).toMatchObject({
      name: "Ahri, Alluring",
      types: ["unit"],
      super_types: ["champion"],
      domains: ["calm"],
      might: 4,
      rules_text: null,
      effect_text: null,
      short_code: null,
    });
  });

  it.each([
    {
      name: "takes the prefix of public_code",
      input: submission(),
      publicCode: "OGN-066/298",
      shortCode: "OGN-066",
    },
    {
      name: "drops a promo or language suffix",
      input: submission({ printings: [{ public_code: "SGN-T07-P-SC" }] }),
      publicCode: "SGN-T07-P-SC",
      shortCode: "SGN-T07",
    },
  ])("derives printing short_code: $name", ({ input, publicCode, shortCode }) => {
    const card = buildUserSubmissionCard(input, USER_ID, STAMP);
    expect(card.printings[0]!.short_code).toBe(shortCode);
    expect(card.printings[0]!.public_code).toBe(publicCode);
  });

  it.each([
    {
      name: "a promo and its base printing that share the short code",
      printings: [{ public_code: "SGN-T07" }, { public_code: "SGN-T07-P" }],
    },
    {
      name: "printings that differ only by finish",
      printings: [
        { public_code: "OGN-066/298", finish: "foil" },
        { public_code: "OGN-066/298", finish: "normal" },
      ],
    },
    {
      name: "printings sharing a public code, finish and language by printing id",
      printings: [
        { public_code: "OGN-066/298", finish: "foil", printing_id: BASE_ID },
        { public_code: "OGN-066/298", finish: "foil", printing_id: PROMO_ID },
      ],
    },
  ])("keeps apart $name", ({ printings }) => {
    const card = buildUserSubmissionCard(submission({ printings }), USER_ID, STAMP);
    expect(card.printings).toHaveLength(2);
    expect(card.printings[0]!.external_id).not.toBe(card.printings[1]!.external_id);
  });

  it("namespaces each printing external_id by slug, stamp, user, finish and language", () => {
    const card = buildUserSubmissionCard(submission(), USER_ID, STAMP);
    expect(card.printings[0]!.external_id).toBe(
      `ahri-alluring:OGN-066--${STAMP}--${USER_ID}:foil:en`,
    );
  });

  it("falls back to normal finish and EN language in the external_id when omitted", () => {
    const card = buildUserSubmissionCard(
      submission({
        printings: [{ public_code: "OGN-001/298" }],
      }),
      USER_ID,
      STAMP,
    );
    expect(card.printings[0]!.external_id).toContain(":normal:en");
    expect(card.printings[0]!.finish).toBeNull();
    expect(card.printings[0]!.language).toBeNull();
  });

  it("uses the finish inferred from the rarity in the external_id", () => {
    const card = buildUserSubmissionCard(
      submission({ printings: [{ public_code: "OGN-066/298", rarity: "epic" }] }),
      USER_ID,
      STAMP,
    );
    expect(card.printings[0]!.external_id).toContain(":foil:en");
    expect(card.printings[0]!.finish).toBeNull();
  });

  it("carries the claimed printing id, null when none was sent", () => {
    const card = buildUserSubmissionCard(
      submission({
        printings: [
          { public_code: "OGN-066/298", printing_id: PROMO_ID },
          { public_code: "OGN-067/298" },
        ],
      }),
      USER_ID,
      STAMP,
    );
    expect(card.printings.map((printing) => printing.printing_id)).toEqual([PROMO_ID, null]);
  });
});

describe("inferSubmissionKind", () => {
  it("calls an unmatched submission a new card", () => {
    const card = buildUserSubmissionCard(submission(), USER_ID, STAMP);
    expect(inferSubmissionKind(card, false)).toBe("new_card");
  });

  it("calls a matched submission carrying card data a correction", () => {
    const card = buildUserSubmissionCard(submission(), USER_ID, STAMP);
    expect(inferSubmissionKind(card, true)).toBe("correction");
  });

  it("calls a matched, stats-free, image-carrying submission an image", () => {
    const card = buildUserSubmissionCard(
      submission({
        card: { name: "Ahri, Alluring" },
        printings: [
          {
            public_code: "OGN-066/298",
            set_id: "ogn",
            set_name: "Origins",
            image_url: "https://example.test/ahri.png",
            language: "EN",
          },
        ],
      }),
      USER_ID,
      STAMP,
    );
    expect(inferSubmissionKind(card, true)).toBe("image");
  });

  it("does not call it an image when only some printings carry one", () => {
    const card = buildUserSubmissionCard(
      submission({
        card: { name: "Ahri, Alluring" },
        printings: [
          { public_code: "OGN-066/298", image_url: "https://example.test/ahri.png" },
          { public_code: "OGN-067/298" },
        ],
      }),
      USER_ID,
      STAMP,
    );
    expect(inferSubmissionKind(card, true)).toBe("correction");
  });
});

describe("ingestUserSubmission printing links", () => {
  const imagePrinting = {
    public_code: "OGN-066/298",
    set_id: "ogn",
    set_name: "Origins",
    finish: "foil",
    language: "EN",
    image_url: "https://example.test/ahri.png",
  };

  // The payload below carries no markers, so the composite key alone lands on the base.
  const keyedPrintings = [
    {
      id: BASE_ID,
      cardId: CARD_ID,
      shortCode: "OGN-066",
      finish: "foil",
      markerSlugs: [],
      language: "EN",
    },
    {
      id: PROMO_ID,
      cardId: CARD_ID,
      shortCode: "OGN-066",
      finish: "foil",
      markerSlugs: ["promo"],
      language: "EN",
    },
  ];

  const sideCards = [
    { printingId: BASE_ID, cardId: CARD_ID },
    { printingId: PROMO_ID, cardId: CARD_ID },
    { printingId: PAIR_ID, cardId: "front-card-uuid" },
    { printingId: PAIR_ID, cardId: CARD_ID },
    { printingId: OTHER_CARD_PRINTING_ID, cardId: "other-card-uuid" },
  ];

  async function ingest(printing: Record<string, unknown>, cardName = "Ahri, Alluring") {
    const insertCandidatePrinting = vi.fn().mockResolvedValue(undefined);
    const insertSubmission = vi.fn().mockResolvedValue("submission-id");
    const liveSnapshot = vi.fn().mockResolvedValue({
      snapshot: { card: null, printings: new Map(), printingsById: new Map() },
      cardSlug: "ahri-alluring",
    });
    const repos = {
      ingest: {
        lockCardAndMetaSubmissions: vi.fn().mockResolvedValue(undefined),
        allCardNorms: vi.fn().mockResolvedValue([{ id: CARD_ID, normName: "ahrialluring" }]),
        allCardNameAliases: vi.fn().mockResolvedValue([]),
        allPrintingKeys: vi.fn().mockResolvedValue(keyedPrintings),
        allPrintingLinkOverrides: vi.fn().mockResolvedValue([]),
        printingSideCards: vi.fn(async (ids: string[]) =>
          sideCards.filter((side) => ids.includes(side.printingId)),
        ),
        insertCandidateCard: vi.fn().mockResolvedValue("new-cc-id"),
        insertCandidatePrinting,
      },
      cardSubmissions: {
        countRecentByUser: vi.fn().mockResolvedValue(0),
        liveSnapshot,
        insert: insertSubmission,
      },
    };
    const transact = ((fn: (r: unknown) => Promise<unknown>) => fn(repos)) as Transact;
    const card = buildUserSubmissionCard(
      submission({ card: { name: cardName }, printings: [{ ...imagePrinting, ...printing }] }),
      USER_ID,
      STAMP,
    );
    const result = await ingestUserSubmission(transact, {
      userId: USER_ID,
      submissionNote: null,
      card,
      now: new Date("2026-07-02T09:00:00.000Z"),
    });
    const linked = insertCandidatePrinting.mock.calls.map(
      (call) => (call[0] as { printingId: string | null }).printingId,
    );
    return { result, linked, liveSnapshot, insertSubmission };
  }

  it.each([
    { name: "the claimed promo, not the base printing sharing its key", printingId: PROMO_ID },
    { name: "a two-sided printing claimed from its back side's card", printingId: PAIR_ID },
  ])("links $name", async ({ printingId }) => {
    const { result, linked } = await ingest({ printing_id: printingId });
    expect(result.status).toBe("ok");
    expect(linked).toEqual([printingId]);
  });

  it("compares against the claimed printing when recording the diff", async () => {
    const { liveSnapshot } = await ingest({ printing_id: PROMO_ID });
    expect(liveSnapshot).toHaveBeenCalledWith(CARD_ID, {
      shortCodes: ["OGN-066"],
      printingIds: [PROMO_ID],
    });
  });

  it.each([
    { name: "belongs to another card", printingId: OTHER_CARD_PRINTING_ID },
    { name: "does not exist", printingId: "0199a000-0000-7000-8000-0000000000ff" },
  ])("ignores a claimed printing that $name", async ({ printingId }) => {
    const { result, linked } = await ingest({ printing_id: printingId });
    expect(result.status).toBe("ok");
    expect(linked).toEqual([BASE_ID]);
  });

  it("ignores a claimed printing when the card name matches no live card", async () => {
    const { result, linked } = await ingest({ printing_id: PROMO_ID }, "Unknown Card");
    expect(result.status).toBe("ok");
    expect(linked).toEqual([null]);
  });

  it("falls back to the composite key without a claimed printing", async () => {
    const { result, linked } = await ingest({});
    expect(result.status).toBe("ok");
    expect(linked).toEqual([BASE_ID]);
  });
});

describe("ingestUserSubmission duplicate printings", () => {
  it("refuses two printings that collapse onto one code, finish and language", async () => {
    const insertCandidateCard = vi.fn();
    const repos = {
      ingest: {
        lockCardAndMetaSubmissions: vi.fn().mockResolvedValue(undefined),
        insertCandidateCard,
      },
      cardSubmissions: { countRecentByUser: vi.fn().mockResolvedValue(0) },
    };
    const transact = ((fn: (r: unknown) => Promise<unknown>) => fn(repos)) as Transact;
    const card = buildUserSubmissionCard(
      submission({
        printings: [
          { public_code: "OGN-066/298", rarity: "epic" },
          { public_code: "OGN-066/298", rarity: "epic", finish: "foil" },
        ],
      }),
      USER_ID,
      STAMP,
    );

    const result = await ingestUserSubmission(transact, {
      userId: USER_ID,
      submissionNote: null,
      card,
      now: new Date("2026-07-02T09:00:00.000Z"),
    });

    expect(result).toEqual({
      status: "invalid",
      errors: ["printings: two printings have the same code, finish and language"],
    });
    expect(insertCandidateCard).not.toHaveBeenCalled();
  });
});
