import { describe, expect, it } from "vitest";

import type {
  ComparablePrintingValues,
  WorkspaceLinkedPrintingRow,
} from "../repositories/workspace-queue.js";
import type { WorkspaceQueueSources } from "./workspace-presenters.js";
import {
  buildWorkspaceQueueEntries,
  linkedPrintingDifferences,
  startOfUtcDay,
  toWorkspaceQueueResponse,
  toWorkspaceEvent,
  toWorkspaceFaceRow,
  toWorkspacePrintingRow,
} from "./workspace-presenters.js";

const T1 = new Date("2026-10-18T09:00:00.000Z");
const T2 = new Date("2026-10-19T09:00:00.000Z");

const LIVE_PRINTING: ComparablePrintingValues = {
  shortCode: "OGN-030",
  setId: "OGN",
  rarity: "rare",
  artVariant: "normal",
  isSigned: false,
  isOvernumbered: false,
  markerSlugs: [],
  distributionChannelSlugs: [],
  finish: "normal",
  size: "standard",
  artist: "Kudos Studio",
  publicCode: "OGN-030/298",
  printedRulesText: "Deal 2 to a unit.",
  printedEffectText: null,
  flavorText: null,
  language: "EN",
  printedName: null,
  printedYear: null,
  releasedAt: "2026-11-01",
  releasePrecision: "month",
  announcedAt: null,
};

function sources(over: Partial<WorkspaceQueueSources> = {}): WorkspaceQueueSources {
  return {
    cardDifferences: [],
    drafts: [],
    linkedPrintings: [],
    newPrintings: [],
    inactiveImages: [],
    submissions: [],
    costKeywords: [],
    ...over,
  };
}

function linked(
  over: Partial<WorkspaceLinkedPrintingRow> = {},
  candidate: Partial<ComparablePrintingValues & { imageUrl: string | null }> = {},
): WorkspaceLinkedPrintingRow {
  return {
    id: "cp-1",
    candidateCardId: "cc-1",
    provider: "provider-a",
    createdAt: T1,
    printedTotal: 298,
    printingId: "printing-1",
    faceId: "face-1",
    side: 1,
    cardSlug: "jinx-loose-cannon",
    cardName: "Jinx, Loose Cannon",
    printingLabel: "OGN-030 normal EN",
    faceShortCode: "OGN-030",
    candidate: { ...LIVE_PRINTING, imageUrl: null, imageFingerprint: null, ...candidate },
    live: { ...LIVE_PRINTING, imageUrls: [], imageFingerprints: [] },
    ...over,
  };
}

describe("linkedPrintingDifferences", () => {
  it("finds nothing when the source matches the live face", () => {
    expect(linkedPrintingDifferences(linked(), [])).toEqual({
      faceFields: [],
      printingFields: [],
      newImage: false,
    });
  });

  it("splits printing-level fields from face fields", () => {
    const row = linked({}, { size: "oversized", artist: "Another Artist" });
    expect(linkedPrintingDifferences(row, [])).toEqual({
      faceFields: ["artist"],
      printingFields: ["size"],
      newImage: false,
    });
  });

  it("flags an image the face does not show yet", () => {
    const row = linked({}, { imageUrl: "https://img.example/new.png" });
    expect(linkedPrintingDifferences(row, []).newImage).toBe(true);
  });

  it("does not flag an image the face already shows", () => {
    const row = linked({}, { imageUrl: "https://img.example/live.png" });
    row.live.imageUrls = ["https://img.example/live.png"];
    expect(linkedPrintingDifferences(row, []).newImage).toBe(false);
  });
});

describe("buildWorkspaceQueueEntries", () => {
  it("leaves a linked candidate printing without differences out of every queue", () => {
    expect(buildWorkspaceQueueEntries(sources({ linkedPrintings: [linked()] }))).toEqual([]);
  });

  it("puts a printing-level difference only in the Printings queue", () => {
    const entries = buildWorkspaceQueueEntries(
      sources({
        linkedPrintings: [linked({}, { distributionChannelSlugs: ["summoner-skirmish"] })],
      }),
    );
    expect(entries).toEqual([
      {
        item: {
          id: "printing:source-difference:printing-1:provider-a",
          owner: "printing",
          segment: "open",
          ownerId: "printing-1",
          cardSlug: "jinx-loose-cannon",
          cardName: "Jinx, Loose Cannon",
          label: "OGN-030 normal EN",
          reason: "source-difference",
          provider: "provider-a",
          isContributor: false,
          decisions: 1,
          fields: ["distributionChannelSlugs"],
          createdAt: T1.toISOString(),
        },
        printingIds: ["printing-1"],
      },
    ]);
  });

  it("puts a release-date-only difference in the open Printings queue", () => {
    const entries = buildWorkspaceQueueEntries(
      sources({
        linkedPrintings: [
          linked(
            {},
            { releasedAt: "2026-11-14", releasePrecision: "day", announcedAt: "2026-10-01" },
          ),
        ],
      }),
    );
    expect(entries.map((entry) => entry.item)).toEqual([
      expect.objectContaining({
        owner: "printing",
        segment: "open",
        ownerId: "printing-1",
        fields: ["releasedAt", "releasePrecision", "announcedAt"],
      }),
    ]);
  });

  it("puts face-field differences only in the Faces queue", () => {
    const entries = buildWorkspaceQueueEntries(
      sources({ linkedPrintings: [linked({}, { rarity: "epic", artist: "Another Artist" })] }),
    );
    expect(entries.map((entry) => entry.item.id)).toEqual([
      "face:source-difference:face-1:provider-a",
    ]);
    expect(entries[0]?.item).toMatchObject({ owner: "face", ownerId: "face-1", decisions: 2 });
  });

  it("assigns each side of a double-faced printing to its own face and card", () => {
    const front = linked({ id: "cp-front" }, { artist: "Front Artist" });
    const back = linked(
      {
        id: "cp-back",
        candidateCardId: "cc-2",
        faceId: "face-2",
        side: 2,
        cardSlug: "vi-piltover-enforcer",
        cardName: "Vi, Piltover Enforcer",
        faceShortCode: "OGN-031",
      },
      { artist: "Back Artist" },
    );
    const entries = buildWorkspaceQueueEntries(sources({ linkedPrintings: [front, back] }));
    expect(entries.map((entry) => entry.item)).toEqual([
      expect.objectContaining({
        ownerId: "face-1",
        cardSlug: "jinx-loose-cannon",
        label: "OGN-030",
      }),
      expect.objectContaining({
        ownerId: "face-2",
        cardSlug: "vi-piltover-enforcer",
        label: "OGN-031 back",
      }),
    ]);
    expect(entries.every((entry) => entry.printingIds[0] === "printing-1")).toBe(true);
  });

  it("merges rows of one source on one face and counts distinct fields", () => {
    const entries = buildWorkspaceQueueEntries(
      sources({
        linkedPrintings: [
          linked({ id: "cp-1", createdAt: T2, printingId: "printing-1" }, { artist: "A" }),
          linked(
            { id: "cp-2", createdAt: T1, printingId: "printing-2" },
            { artist: "B", rarity: "epic" },
          ),
        ],
      }),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]?.item).toMatchObject({ decisions: 2, createdAt: T1.toISOString() });
    expect(entries[0]?.printingIds.toSorted()).toEqual(["printing-1", "printing-2"]);
  });

  it("keeps a contributor's printing proposal per submission and marks it", () => {
    const entries = buildWorkspaceQueueEntries(
      sources({
        linkedPrintings: [
          linked({ provider: "usersubmission", candidateCardId: "cc-9" }, { rarity: "epic" }),
        ],
      }),
    );
    expect(entries[0]?.item).toMatchObject({
      id: "face:contributor-proposal:face-1:cc-9",
      reason: "contributor-proposal",
      isContributor: true,
    });
  });

  it("puts card-field differences in the Cards queue", () => {
    const live = {
      name: "Jinx, Loose Cannon",
      types: ["unit"],
      superTypes: ["champion"],
      domains: ["fury"],
      might: 3,
      energy: 4,
      power: 1,
      mightBonus: null,
      tags: ["jinx"],
    };
    const entries = buildWorkspaceQueueEntries(
      sources({
        cardDifferences: [
          {
            id: "cc-1",
            provider: "provider-a",
            createdAt: T1,
            cardSlug: "jinx-loose-cannon",
            cardName: "Jinx, Loose Cannon",
            live,
            candidate: { ...live, might: 4, energy: 5 },
          },
          {
            id: "cc-2",
            provider: "provider-b",
            createdAt: T1,
            cardSlug: "jinx-loose-cannon",
            cardName: "Jinx, Loose Cannon",
            live,
            candidate: live,
          },
        ],
      }),
    );
    expect(entries.map((entry) => entry.item)).toEqual([
      expect.objectContaining({
        id: "card:source-difference:jinx-loose-cannon:provider-a",
        owner: "card",
        segment: "open",
        decisions: 2,
        fields: expect.any(Array),
      }),
    ]);
  });

  it("groups new-card drafts by normalized name", () => {
    const entries = buildWorkspaceQueueEntries(
      sources({
        drafts: [
          {
            id: "cc-1",
            provider: "provider-b",
            normName: "ahrininetailedfox",
            name: "Ahri",
            createdAt: T2,
          },
          {
            id: "cc-2",
            provider: "usersubmission",
            normName: "ahrininetailedfox",
            name: "Ahri, Nine-Tailed Fox",
            createdAt: T1,
          },
        ],
      }),
    );
    expect(entries.map((entry) => entry.item)).toEqual([
      expect.objectContaining({
        id: "card:new-card:ahrininetailedfox",
        segment: "new",
        cardSlug: null,
        cardName: "Ahri, Nine-Tailed Fox",
        provider: "usersubmission",
        isContributor: true,
        createdAt: T1.toISOString(),
      }),
    ]);
  });

  it("puts an unlinked candidate printing in Printings under New", () => {
    const entries = buildWorkspaceQueueEntries(
      sources({
        newPrintings: [
          {
            id: "cp-7",
            candidateCardId: "cc-7",
            provider: "provider-a",
            createdAt: T1,
            cardSlug: "yasuo-unforgiven",
            cardName: "Yasuo, Unforgiven",
            shortCode: "OGN-205",
            finish: "normal",
            language: "FR",
          },
        ],
      }),
    );
    expect(entries[0]?.item).toMatchObject({
      id: "printing:new-printing:cp-7",
      owner: "printing",
      segment: "new",
      ownerId: "cp-7",
      label: "OGN-205 normal FR",
    });
  });

  it("puts an inactive upload in Faces with the printings showing that face", () => {
    const entries = buildWorkspaceQueueEntries(
      sources({
        inactiveImages: [
          {
            imageId: "img-1",
            faceId: "face-3",
            createdAt: T1,
            cardSlug: "teemo-swift-scout",
            cardName: "Teemo, Swift Scout",
            shortCode: "OGN-112",
            printingIds: ["printing-3", "printing-4"],
            isBack: false,
          },
        ],
      }),
    );
    expect(entries).toEqual([
      {
        item: expect.objectContaining({
          id: "face:new-image:face-3:img-1",
          owner: "face",
          reason: "new-image",
          provider: null,
        }),
        printingIds: ["printing-3", "printing-4"],
      },
    ]);
  });

  describe("contributor submissions", () => {
    const submission = {
      id: "sub-1",
      provider: "usersubmission",
      cardName: "Yasuo, Unforgiven",
      candidateCardId: "cc-9",
      cardSlug: "yasuo-unforgiven",
      proposedDiff: ["card.might", "card.tags", "printing.OGN-205.rarity"],
      createdAt: T1,
    };

    it("counts only card fields on the card item", () => {
      const entries = buildWorkspaceQueueEntries(sources({ submissions: [submission] }));
      expect(entries[0]?.item).toMatchObject({
        id: "card:contributor-proposal:yasuo-unforgiven:sub-1",
        owner: "card",
        reason: "contributor-proposal",
        isContributor: true,
        decisions: 2,
        fields: ["might", "tags"],
      });
    });

    it("skips the card item when its face proposals are queued elsewhere", () => {
      const entries = buildWorkspaceQueueEntries(
        sources({
          submissions: [{ ...submission, proposedDiff: ["printing.OGN-205.rarity"] }],
          linkedPrintings: [
            linked({ provider: "usersubmission", candidateCardId: "cc-9" }, { rarity: "epic" }),
          ],
        }),
      );
      expect(entries.map((entry) => entry.item.owner)).toEqual(["face"]);
    });

    it("keeps a card item when nothing else is left to settle", () => {
      const entries = buildWorkspaceQueueEntries(
        sources({ submissions: [{ ...submission, proposedDiff: [] }] }),
      );
      expect(entries[0]?.item).toMatchObject({ owner: "card", decisions: 1 });
    });

    it("leaves a submission without a card to the draft", () => {
      const entries = buildWorkspaceQueueEntries(
        sources({ submissions: [{ ...submission, cardSlug: null }] }),
      );
      expect(entries).toEqual([]);
    });
  });

  describe("listings", () => {
    const listing = {
      marketplace: "cardmarket" as const,
      externalId: 812,
      finish: "foil",
      language: null,
      productName: "Jinx Loose Cannon",
      createdAt: T1,
    };
    const suggested = {
      ...listing,
      printingId: "printing-1",
      printingLabel: "OGN-030 foil EN",
      cardSlug: "jinx-loose-cannon",
      cardName: "Jinx, Loose Cannon",
      score: 150,
      strength: "strong" as const,
    };

    it("puts a suggested listing on its printing's Open queue", () => {
      const entries = buildWorkspaceQueueEntries(
        sources({ listings: { suggested: [suggested], unmatched: [] } }),
      );
      expect(entries).toEqual([
        {
          item: {
            id: "printing:listing:printing-1:cardmarket",
            owner: "printing",
            segment: "open",
            ownerId: "printing-1",
            reason: "listing",
            cardSlug: "jinx-loose-cannon",
            cardName: "Jinx, Loose Cannon",
            label: "OGN-030 foil EN",
            provider: "Cardmarket",
            isContributor: false,
            decisions: 1,
            fields: ["listing"],
            createdAt: T1.toISOString(),
          },
          printingIds: ["printing-1"],
        },
      ]);
    });

    it("folds two listings from one marketplace on a printing into one item", () => {
      const entries = buildWorkspaceQueueEntries(
        sources({
          listings: {
            suggested: [suggested, { ...suggested, externalId: 813, createdAt: T2 }],
            unmatched: [],
          },
        }),
      );
      expect(entries.map((entry) => entry.item.id)).toEqual([
        "printing:listing:printing-1:cardmarket",
      ]);
      expect(entries[0]?.item.createdAt).toBe(T1.toISOString());
    });

    it("puts an unsuggested listing on the printing New queue under its SKU key", () => {
      const entries = buildWorkspaceQueueEntries(
        sources({
          listings: {
            suggested: [],
            unmatched: [
              { ...listing, card: null },
              {
                ...listing,
                marketplace: "cardtrader",
                finish: "normal",
                language: "FR",
                card: { slug: "jinx-loose-cannon", name: "Jinx, Loose Cannon" },
              },
            ],
          },
        }),
      );
      expect(entries.map((entry) => entry.item)).toMatchObject([
        {
          owner: "printing",
          segment: "new",
          ownerId: "listing:cardmarket:812:foil",
          cardSlug: null,
          cardName: "Jinx Loose Cannon",
          label: "#812 foil",
          provider: "Cardmarket",
          fields: [],
        },
        {
          ownerId: "listing:cardtrader:812:normal:FR",
          cardSlug: "jinx-loose-cannon",
          cardName: "Jinx, Loose Cannon",
          label: "#812 normal FR",
          provider: "CardTrader",
        },
      ]);
    });
  });
});

describe("toWorkspaceQueueResponse", () => {
  const item = (over: object) => ({
    id: "x",
    owner: "card" as const,
    segment: "open" as const,
    ownerId: "x",
    cardSlug: null,
    cardName: "X",
    label: "X",
    reason: "source-difference" as const,
    provider: null,
    isContributor: false,
    decisions: 1,
    fields: [],
    createdAt: T2.toISOString(),
    ...over,
  });

  it("counts every owner and narrows items to the requested one", () => {
    const response = toWorkspaceQueueResponse(
      [
        item({ id: "a" }),
        item({ id: "b", segment: "new", createdAt: T1.toISOString() }),
        item({ id: "c", owner: "face" }),
      ],
      7,
      "face",
    );
    expect(response.items.map((row) => row.id)).toEqual(["c"]);
    expect(response.counts).toEqual({
      card: { open: 1, new: 1, oldestAt: T1.toISOString() },
      face: { open: 1, new: 0, oldestAt: T2.toISOString() },
      printing: { open: 0, new: 0, oldestAt: null },
    });
    expect(response.doneToday).toBe(7);
  });

  it("orders items oldest first", () => {
    const response = toWorkspaceQueueResponse(
      [item({ id: "late" }), item({ id: "early", createdAt: T1.toISOString() })],
      0,
    );
    expect(response.items.map((row) => row.id)).toEqual(["early", "late"]);
  });
});

describe("toWorkspacePrintingRow", () => {
  const row = {
    id: "printing-1",
    cardSlug: "jinx-loose-cannon",
    cardName: "Jinx, Loose Cannon",
    setName: "Origins",
    shortCode: "OGN-030",
    publicCode: "OGN-030/298",
    language: "EN",
    finish: "foil",
    imageUrl: null,
    faceCount: 2,
    isDoubleSided: true,
    imageCount: 3,
    markers: ["Promo"],
    channelLabel: "Organized play › Skirmish",
    status: "announced" as const,
    updatedAt: T1,
  };

  it("maps a printing row with its face count and badges", () => {
    expect(toWorkspacePrintingRow(row)).toEqual({
      id: "printing-1",
      cardSlug: "jinx-loose-cannon",
      cardName: "Jinx, Loose Cannon",
      setName: "Origins",
      shortCode: "OGN-030",
      publicCode: "OGN-030/298",
      language: "EN",
      finish: "foil",
      imageUrl: null,
      faceCount: 2,
      isDoubleSided: true,
      imageCount: 3,
      markers: ["Promo"],
      channelLabel: "Organized play › Skirmish",
      status: "announced",
      updatedAt: T1.toISOString(),
    });
  });

  it("marks promo and own printings for a desk caller", () => {
    const desk = { promoIds: new Set(["printing-1"]), createdIds: new Set<string>() };
    expect(toWorkspacePrintingRow(row, desk)).toMatchObject({
      isPromo: true,
      createdByMe: false,
    });
  });

  it("leaves the desk flags off for a reviewer", () => {
    expect(toWorkspacePrintingRow(row)).not.toHaveProperty("isPromo");
  });
});

describe("toWorkspaceFaceRow", () => {
  it("maps a face row with its printing count and image state", () => {
    const row = {
      id: "face-1",
      cardSlug: "jinx-loose-cannon",
      cardName: "Jinx, Loose Cannon",
      setName: "Origins",
      shortCode: "OGN-030",
      language: "EN",
      finish: "foil",
      imageUrl: null,
      printingCount: 2,
      artist: "Kudos Studio",
      rarity: "rare",
      artVariant: "normal",
      imageState: "substitute" as const,
      updatedAt: T1,
    };
    const mapped = toWorkspaceFaceRow(row);
    expect(mapped).toMatchObject({
      printingCount: 2,
      artist: "Kudos Studio",
      rarity: "rare",
      artVariant: "normal",
      imageState: "substitute",
    });
    expect(mapped).not.toHaveProperty("faceCount");
  });
});

describe("toWorkspaceEvent", () => {
  const event = {
    id: "event-1",
    action: "printing.accept-field",
    entityType: "printing",
    entityId: "printing-1",
    entityLabel: "OGN-030",
    cardSlug: "jinx-loose-cannon",
    createdAt: T1,
  };

  it("labels an event by its entity label", () => {
    expect(toWorkspaceEvent(event)).toEqual({
      id: "event-1",
      action: "printing.accept-field",
      label: "OGN-030",
      entityType: "printing",
      entityId: "printing-1",
      cardSlug: "jinx-loose-cannon",
      createdAt: T1.toISOString(),
    });
  });

  it("falls back to the card slug, then the entity id", () => {
    expect(toWorkspaceEvent({ ...event, entityLabel: null }).label).toBe("jinx-loose-cannon");
    expect(toWorkspaceEvent({ ...event, entityLabel: null, cardSlug: null }).label).toBe(
      "printing-1",
    );
    expect(
      toWorkspaceEvent({ ...event, entityLabel: null, cardSlug: null, entityId: null }).label,
    ).toBe("");
  });
});

describe("startOfUtcDay", () => {
  it("truncates to midnight UTC", () => {
    expect(startOfUtcDay(new Date("2026-10-21T23:59:59.999Z"))).toEqual(
      new Date("2026-10-21T00:00:00.000Z"),
    );
  });
});
