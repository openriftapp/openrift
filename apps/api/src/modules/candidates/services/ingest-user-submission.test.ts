import type { CardSubmissionInput } from "@openrift/shared/contracts/card-submissions";
import { describe, expect, it, vi } from "vitest";

import type { Transact } from "../../../deps.js";
import {
  buildUserSubmissionCard,
  inferSubmissionKind,
  ingestUserSubmission,
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

  it("derives printing short_code from the prefix of public_code", () => {
    const card = buildUserSubmissionCard(submission(), USER_ID, STAMP);
    expect(card.printings[0]!.short_code).toBe("OGN-066");
    expect(card.printings[0]!.public_code).toBe("OGN-066/298");
  });

  it("drops a promo or language suffix from the short_code", () => {
    const card = buildUserSubmissionCard(
      submission({ printings: [{ public_code: "SGN-T07-P-SC" }] }),
      USER_ID,
      STAMP,
    );
    expect(card.printings[0]!.short_code).toBe("SGN-T07");
    expect(card.printings[0]!.public_code).toBe("SGN-T07-P-SC");
  });

  it("keeps a promo apart from its base printing that shares the short code", () => {
    const card = buildUserSubmissionCard(
      submission({ printings: [{ public_code: "SGN-T07" }, { public_code: "SGN-T07-P" }] }),
      USER_ID,
      STAMP,
    );
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

  it("keeps multiple printings distinct", () => {
    const card = buildUserSubmissionCard(
      submission({
        printings: [
          { public_code: "OGN-066/298", finish: "foil" },
          { public_code: "OGN-066/298", finish: "normal" },
        ],
      }),
      USER_ID,
      STAMP,
    );
    expect(card.printings).toHaveLength(2);
    expect(card.printings[0]!.external_id).not.toBe(card.printings[1]!.external_id);
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

  it("keeps printings sharing a public code, finish and language apart by printing id", () => {
    const card = buildUserSubmissionCard(
      submission({
        printings: [
          { public_code: "OGN-066/298", finish: "foil", printing_id: BASE_ID },
          { public_code: "OGN-066/298", finish: "foil", printing_id: PROMO_ID },
        ],
      }),
      USER_ID,
      STAMP,
    );
    expect(card.printings[0]!.external_id).not.toBe(card.printings[1]!.external_id);
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
    { id: BASE_ID, shortCode: "OGN-066", finish: "foil", markerSlugs: [], language: "EN" },
    { id: PROMO_ID, shortCode: "OGN-066", finish: "foil", markerSlugs: ["promo"], language: "EN" },
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
        lockUserSubmissions: vi.fn().mockResolvedValue(undefined),
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

  it("links the claimed promo, not the base printing sharing its key", async () => {
    const { result, linked } = await ingest({ printing_id: PROMO_ID });
    expect(result.status).toBe("ok");
    expect(linked).toEqual([PROMO_ID]);
  });

  it("links a two-sided printing claimed from its back side's card", async () => {
    const { result, linked } = await ingest({ printing_id: PAIR_ID });
    expect(result.status).toBe("ok");
    expect(linked).toEqual([PAIR_ID]);
  });

  it("compares against the claimed printing when recording the diff", async () => {
    const { liveSnapshot } = await ingest({ printing_id: PROMO_ID });
    expect(liveSnapshot).toHaveBeenCalledWith(CARD_ID, {
      shortCodes: ["OGN-066"],
      printingIds: [PROMO_ID],
    });
  });

  it("ignores a claimed printing that belongs to another card", async () => {
    const { result, linked } = await ingest({ printing_id: OTHER_CARD_PRINTING_ID });
    expect(result.status).toBe("ok");
    expect(linked).toEqual([BASE_ID]);
  });

  it("ignores a claimed printing that does not exist", async () => {
    const { linked } = await ingest({ printing_id: "0199a000-0000-7000-8000-0000000000ff" });
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
