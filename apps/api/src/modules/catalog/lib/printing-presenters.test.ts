import type {
  Marker,
  PrintingCitation,
  PrintingDistributionChannel,
} from "@openrift/shared/types/catalog";
import { describe, expect, it } from "vitest";

import {
  buildPrintingsResponse,
  presentPrintingValues,
  referencedChannels,
  referencedMarkers,
  resolveFallbackArt,
  resolveMarkers,
  toCatalogPrintingImage,
} from "./printing-presenters.js";

describe("resolveFallbackArt", () => {
  it("omits both fields for the auto default", () => {
    expect(resolveFallbackArt({ fallbackArtMode: "auto", fallbackImageId: null })).toEqual({});
  });

  it("emits the mode alone when the substitute is suppressed", () => {
    expect(resolveFallbackArt({ fallbackArtMode: "none", fallbackImageId: null })).toEqual({
      fallbackArtMode: "none",
    });
  });

  it("emits mode and image id together for a pin", () => {
    expect(resolveFallbackArt({ fallbackArtMode: "pinned", fallbackImageId: "img-1" })).toEqual({
      fallbackArtMode: "pinned",
      fallbackImageId: "img-1",
    });
  });

  it("degrades a pin with no servable image to auto", () => {
    expect(resolveFallbackArt({ fallbackArtMode: "pinned", fallbackImageId: null })).toEqual({});
  });

  it("treats an unknown mode as auto", () => {
    expect(resolveFallbackArt({ fallbackArtMode: "future-mode", fallbackImageId: null })).toEqual(
      {},
    );
  });
});

const MARKER: Marker = {
  id: "m-1",
  slug: "promo",
  label: "Promo",
  description: null,
};

function printingRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    printingId: id,
    side: 1,
    faceId: id,
    otherSide: null,
    cardId: "card-1",
    setId: "set-1",
    shortCode: "OGN-202",
    rarity: "rare",
    artVariant: "normal",
    isSigned: false,
    markerSlugs: ["promo"],
    fallbackArtMode: "auto",
    fallbackImageId: null,
    finish: "foil",
    size: "standard",
    artist: "Kudos Productions",
    publicCode: "OGN-202/298",
    printedRulesText: null,
    printedEffectText: null,
    flavorText: null,
    printedName: null,
    printedYear: 2025,
    language: "EN",
    comment: null,
    canonicalRank: 1,
    ...overrides,
  } as never;
}

function citation(id: string): PrintingCitation {
  return { id, label: "Launch party unboxing", sourceUrl: "https://youtu.be/abc" };
}

const NO_CHANNELS = new Map<string, PrintingDistributionChannel[]>();
const MARKERS = new Map([["promo", MARKER]]);

describe("resolveMarkers", () => {
  it("resolves known slugs and drops stale ones", () => {
    expect(resolveMarkers(["promo", "gone"], MARKERS)).toEqual([MARKER]);
  });
});

describe("buildPrintingsResponse", () => {
  it("attaches a printing's citations", () => {
    const citations = new Map([["p-1", [citation("c-1"), citation("c-2")]]]);

    const [printing] = buildPrintingsResponse([printingRow("p-1")], [], {
      channels: [],
      markerBySlug: MARKERS,
      channelsByPrinting: NO_CHANNELS,
      citationsByPrinting: citations,
    });

    expect(printing!.citations).toHaveLength(2);
  });

  it("omits the key entirely for an uncited printing", () => {
    const [printing] = buildPrintingsResponse([printingRow("p-1")], [], {
      channels: [],
      markerBySlug: MARKERS,
      channelsByPrinting: NO_CHANNELS,
      citationsByPrinting: new Map(),
    });

    expect(printing!.citations).toBeUndefined();
    expect(Object.hasOwn(printing!, "citations")).toBe(false);
  });

  it("keeps each printing's citations to itself", () => {
    const citations = new Map([["p-2", [citation("c-1")]]]);

    const [first, second] = buildPrintingsResponse([printingRow("p-1"), printingRow("p-2")], [], {
      channels: [],
      markerBySlug: MARKERS,
      channelsByPrinting: NO_CHANNELS,
      citationsByPrinting: citations,
    });

    expect(first!.citations).toBeUndefined();
    expect(second!.citations).toEqual([citation("c-1")]);
  });

  it("sends hasFoilTwin only when the printing has one", () => {
    const [twinned, single] = buildPrintingsResponse(
      [printingRow("p-1", { hasFoilTwin: true }), printingRow("p-2", { hasFoilTwin: false })],
      [],
      {
        channels: [],
        markerBySlug: MARKERS,
        channelsByPrinting: NO_CHANNELS,
        citationsByPrinting: new Map(),
      },
    );

    expect(twinned!.hasFoilTwin).toBe(true);
    expect(Object.hasOwn(single!, "hasFoilTwin")).toBe(false);
  });

  it("still resolves markers, channels, and images alongside citations", () => {
    const link: PrintingDistributionChannel = {
      channel: {
        id: "ch-1",
        slug: "launch-party",
        label: "Launch Party",
        description: null,
        kind: "event",
        parentId: null,
        childrenLabel: null,
      },
      distributionNote: "Handed out at the door",
      ancestorLabels: [],
    };

    const [printing] = buildPrintingsResponse(
      [printingRow("p-1")],
      [{ printingId: "p-1", side: 1, imageId: "img-1", credit: null } as never],
      {
        channels: [],
        markerBySlug: MARKERS,
        channelsByPrinting: new Map([["p-1", [link]]]),
        citationsByPrinting: new Map([["p-1", [citation("c-1")]]]),
      },
    );

    expect(printing!.markers).toEqual([MARKER]);
    expect(printing!.distributionChannels).toEqual([link]);
    expect(printing!.images).toEqual([{ imageId: "img-1" }]);
    expect(printing!.citations).toEqual([citation("c-1")]);
  });
});

describe("toCatalogPrintingImage", () => {
  const row = { imageId: "img-1", credit: null };

  it("omits the credit key for an uncredited file", () => {
    const image = toCatalogPrintingImage(row);

    expect(image).toEqual({ imageId: "img-1" });
    expect(Object.hasOwn(image, "credit")).toBe(false);
  });

  it("carries the credit when it is set", () => {
    expect(toCatalogPrintingImage({ ...row, credit: "gamesnight" })).toEqual({
      imageId: "img-1",
      credit: "gamesnight",
    });
  });
});

describe("presentPrintingValues", () => {
  const channel = {
    id: "ch-1",
    slug: "launch-party",
    label: "Launch Party",
    description: null,
    kind: "event" as const,
    parentId: null,
    childrenLabel: null,
  };
  const link: PrintingDistributionChannel = {
    channel,
    distributionNote: "Handed out at the door",
    ancestorLabels: [],
  };
  const decorations = {
    channels: [channel],
    markerBySlug: MARKERS,
    channelsByPrinting: new Map([["p-1", [link]]]),
    citationsByPrinting: new Map([["p-1", [citation("c-1")]]]),
  };
  const bare = { ...decorations, channelsByPrinting: NO_CHANNELS, citationsByPrinting: new Map() };

  it("keys by printing id, drops the identity fields and names markers and channels by slug", () => {
    const values = presentPrintingValues(
      [printingRow("p-1", { slug: "en-ogn-202-foil-standard", hasFoilTwin: true })],
      [{ printingId: "p-1", side: 1, imageId: "img-1", credit: null } as never],
      decorations,
    );

    expect(Object.keys(values)).toEqual(["p-1"]);
    const value = values["p-1"]!;
    expect(value).not.toHaveProperty("printingId");
    expect(value).not.toHaveProperty("side");
    expect(value).not.toHaveProperty("faceId");
    expect(value).toMatchObject({
      slug: "en-ogn-202-foil-standard",
      markers: ["promo"],
      distributionChannels: [{ channel: "launch-party", note: "Handed out at the door" }],
      images: [{ imageId: "img-1" }],
      citations: [citation("c-1")],
      hasFoilTwin: true,
    });
  });

  it("keeps faceId only when it differs from the printing id and nests side 2", () => {
    const values = presentPrintingValues(
      [
        printingRow("p-2", { faceId: "face-1", otherSide: { faceId: "face-2" } }),
        printingRow("p-2", { side: 2, faceId: "face-2", cardId: "card-2", markerSlugs: [] }),
      ],
      [],
      bare,
    );

    const value = values["p-2"]!;
    expect(value.faceId).toBe("face-1");
    expect(value.side2).toMatchObject({ faceId: "face-2", cardId: "card-2", markers: [] });
    expect(value.side2).not.toHaveProperty("slug");
  });

  it("ignores a side 2 row whose side 1 is missing", () => {
    expect(
      presentPrintingValues([printingRow("p-3", { side: 2, faceId: "face-2" })], [], bare),
    ).toEqual({});
  });
});

describe("referencedMarkers", () => {
  it("returns the named markers in catalog order and skips the rest", () => {
    const signed: Marker = { id: "m-2", slug: "signed", label: "Signed", description: null };
    const unused: Marker = { id: "m-3", slug: "unused", label: "Unused", description: null };
    const markerBySlug = new Map([
      ["promo", MARKER],
      ["signed", signed],
      ["unused", unused],
    ]);
    expect(
      referencedMarkers([{ markerSlugs: ["signed"] }, { markerSlugs: ["promo", "gone"] }], {
        markerBySlug,
      }),
    ).toEqual([MARKER, signed]);
  });
});

describe("referencedChannels", () => {
  const parent = {
    id: "ch-parent",
    slug: "events",
    label: "Events",
    description: null,
    kind: "event" as const,
    parentId: null,
    childrenLabel: null,
  };
  const child = {
    ...parent,
    id: "ch-child",
    slug: "nexus-night",
    label: "Nexus Night",
    parentId: "ch-parent",
  };
  const other = { ...parent, id: "ch-other", slug: "starter", label: "Starter" };

  it("returns the named channels with their ancestors, in catalog order", () => {
    const channels = referencedChannels(["p-1", "p-none"], {
      channels: [other, parent, child],
      channelsByPrinting: new Map([
        ["p-1", [{ channel: child, distributionNote: null, ancestorLabels: ["Events"] }]],
      ]),
    });
    expect(channels.map((c) => c.slug)).toEqual(["events", "nexus-night"]);
  });

  it("returns nothing for printings with no channel", () => {
    expect(
      referencedChannels(["p-1"], { channels: [parent], channelsByPrinting: NO_CHANNELS }),
    ).toEqual([]);
  });
});
