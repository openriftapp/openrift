import type { WorkspaceQueueItem } from "@openrift/shared/contracts/admin/catalog-workspace";
import type { AdminPrintingImageResponse } from "@openrift/shared/types/api/admin";
import { beforeEach, describe, expect, it } from "vitest";

import { makeAdminPrinting, resetIdCounter } from "@/test/factories";

import {
  buildFaceTree,
  CARD_RECORD_FIELDS,
  cardTypeLine,
  cardWaitingSince,
  faceOpenCounts,
  formatRecordValue,
  primaryCardImage,
} from "./record-fields";

beforeEach(() => {
  resetIdCounter();
});

function image(overrides: Partial<AdminPrintingImageResponse>): AdminPrintingImageResponse {
  return {
    id: "img",
    printingId: "p",
    imageFileId: "file",
    face: "front",
    originalUrl: "https://img.test/original.png",
    rehostedUrl: null,
    rotation: 0,
    needsTrim: false,
    isActive: true,
    ...overrides,
  };
}

function queueItem(overrides: Partial<WorkspaceQueueItem>): WorkspaceQueueItem {
  return {
    id: "item",
    owner: "card",
    segment: "open",
    ownerId: "jinx",
    cardSlug: "jinx",
    cardName: "Jinx, Demolitionist",
    label: "Name",
    reason: "source-difference",
    fields: [],
    provider: "scans",
    isContributor: false,
    decisions: 1,
    createdAt: "2026-10-16T10:00:00.000Z",
    ...overrides,
  };
}

describe("buildFaceTree", () => {
  const standard = makeAdminPrinting({ id: "p1", faceId: "f1", shortCode: "OGN-030" });
  const foil = makeAdminPrinting({
    id: "p2",
    faceId: "f1",
    shortCode: "OGN-030",
    markerSlugs: ["promo"],
    canonicalRank: 1,
  });
  const chinese = makeAdminPrinting({
    id: "p3",
    faceId: "f2",
    shortCode: "OGN-030",
    language: "ZH",
    canonicalRank: 2,
  });
  const paired = makeAdminPrinting({
    id: "p4",
    faceId: "f3",
    shortCode: "OGN-030s",
    canonicalRank: 3,
    otherFace: { faceId: "f9", cardName: "Gold", cardSlug: "gold", publicCode: "OGN-T01" },
  });

  it("groups printings under their face with open counts and the active image", () => {
    const tree = buildFaceTree(
      [standard, foil, chinese, paired],
      [image({ printingId: "p2", isActive: true })],
      new Map([["f1", 2]]),
    );

    expect(tree.map((entry) => [entry.faceId, entry.openItems, entry.printings.length])).toEqual([
      ["f1", 2, 2],
      ["f2", 0, 1],
      ["f3", 0, 1],
    ]);
    expect(tree[0]?.imageUrl).toBe("https://img.test/original.png");
    expect(tree[1]?.imageUrl).toBeNull();
  });

  it("writes a double-faced printing as both codes in side order", () => {
    const back = { ...paired, side: 2 as const };
    expect(buildFaceTree([paired], [], new Map())[0]?.printings[0]?.code).toBe(
      "OGN-030s // OGN-T01",
    );
    expect(buildFaceTree([back], [], new Map())[0]?.printings[0]?.code).toBe("OGN-T01 // OGN-030s");
  });

  it("filters by language and marker", () => {
    expect(
      buildFaceTree([standard, foil, chinese], [], new Map(), { language: "ZH" }).map(
        (entry) => entry.faceId,
      ),
    ).toEqual(["f2"]);
    expect(
      buildFaceTree([standard, foil, chinese], [], new Map(), { marker: "promo" }).flatMap(
        (entry) => entry.printings.map((row) => row.id),
      ),
    ).toEqual(["p2"]);
  });
});

describe("primaryCardImage", () => {
  it("takes the first active image by canonical rank", () => {
    const first = makeAdminPrinting({ id: "a", canonicalRank: 0 });
    const second = makeAdminPrinting({ id: "b", canonicalRank: 1 });
    expect(
      primaryCardImage(
        [second, first],
        [
          image({ printingId: "b", originalUrl: "https://img.test/b.png" }),
          image({ printingId: "a", isActive: false }),
        ],
      ),
    ).toBe("https://img.test/b.png");
    expect(primaryCardImage([first], [])).toBeNull();
  });
});

describe("faceOpenCounts", () => {
  it("counts face items of this card only", () => {
    const counts = faceOpenCounts(
      [
        queueItem({ owner: "face", ownerId: "f1" }),
        queueItem({ owner: "face", ownerId: "f1" }),
        queueItem({ owner: "face", ownerId: "f2", cardSlug: "lux" }),
        queueItem({ owner: "card", ownerId: "jinx" }),
      ],
      "jinx",
    );
    expect([...counts]).toEqual([["f1", 2]]);
  });
});

describe("cardWaitingSince", () => {
  it("returns the oldest card item for the record", () => {
    expect(
      cardWaitingSince(
        [
          queueItem({ createdAt: "2026-10-18T00:00:00.000Z" }),
          queueItem({ createdAt: "2026-10-16T00:00:00.000Z" }),
          queueItem({ owner: "face", createdAt: "2026-10-01T00:00:00.000Z" }),
        ],
        "jinx",
      ),
    ).toBe("2026-10-16T00:00:00.000Z");
    expect(cardWaitingSince([], "jinx")).toBeNull();
  });
});

const labels = {
  cardTypes: { unit: "Unit" },
  superTypes: { champion: "Champion" },
  domains: { fury: "Fury", chaos: "Chaos" },
};

describe("CARD_RECORD_FIELDS", () => {
  it("lists the compared fields first, then the card-only ones", () => {
    expect(CARD_RECORD_FIELDS.map((entry) => entry.field)).toEqual([
      "name",
      "types",
      "superTypes",
      "domains",
      "might",
      "energy",
      "power",
      "mightBonus",
      "tags",
      "maxCopiesOverride",
      "additionalLegendCount",
      "comment",
    ]);
    expect(CARD_RECORD_FIELDS.filter((entry) => entry.comparable)).toHaveLength(9);
  });
});

describe("formatRecordValue", () => {
  it("shows a dash for empty values", () => {
    expect(formatRecordValue("might", null)).toBe("—");
    expect(formatRecordValue("tags", [])).toBe("—");
    expect(formatRecordValue("name", "")).toBe("—");
  });

  it("resolves enum labels for typed list fields", () => {
    expect(formatRecordValue("domains", ["fury", "chaos"], labels)).toBe("Fury · Chaos");
    expect(formatRecordValue("types", ["unit"], labels)).toBe("Unit");
  });

  it("falls back to the slug when a label is missing", () => {
    expect(formatRecordValue("domains", ["order"], labels)).toBe("order");
  });

  it("leaves untyped values as text", () => {
    expect(formatRecordValue("tags", ["Jinx", "Zaun"], labels)).toBe("Jinx · Zaun");
    expect(formatRecordValue("might", 0)).toBe("0");
  });
});

describe("cardTypeLine", () => {
  it("joins types, supertypes and domains", () => {
    expect(
      cardTypeLine(
        { types: ["unit"], superTypes: ["champion"], domains: ["fury", "chaos"] },
        labels,
      ),
    ).toBe("Unit · Champion · Fury, Chaos");
  });

  it("drops the domain part when there are none", () => {
    expect(cardTypeLine({ types: ["unit"], superTypes: [], domains: [] }, labels)).toBe("Unit");
  });
});
