import type { CardLabels } from "@openrift/shared/scan/labels";
import { WellKnown } from "@openrift/shared/well-known";
import { describe, expect, it } from "vitest";

import { scanKeyName, toIdentifyCandidates } from "@/features/scan/lib/scan-identify";
import type { ScanPrintingIndex } from "@/features/scan/lib/scan-resolve";
import { stubPrinting } from "@/test/factories";

const labels: CardLabels = {
  "key-portrait": { name: "Yasuo", code: "OGN-042", language: "EN" },
  "key-landscape": {
    name: "Howling Abyss",
    code: "OGN-101",
    language: "EN",
    type: WellKnown.cardType.BATTLEFIELD,
  },
  "key-legend": { name: "Kingpin", code: "OGN-301", language: "EN", type: "legend" },
};

const legend = stubPrinting({ card: { name: "Kingpin", types: ["legend"], tags: ["Sett"] } });

const index: ScanPrintingIndex = {
  byImageId: new Map([["key-legend", [legend]]]),
  keysByArtKey: new Map(),
};

describe("toIdentifyCandidates", () => {
  it("names each candidate apart from its code and marks battlefields as landscape", () => {
    expect(
      toIdentifyCandidates(index, labels, [
        { key: "key-portrait", artKey: "art-1" },
        { key: "key-landscape", artKey: "art-2" },
      ]),
    ).toEqual([
      {
        key: "key-portrait",
        artKey: "art-1",
        name: "Yasuo",
        detail: "OGN-042 EN",
        landscape: false,
      },
      {
        key: "key-landscape",
        artKey: "art-2",
        name: "Howling Abyss",
        detail: "OGN-101 EN",
        landscape: true,
      },
    ]);
  });

  it("leaves the name empty for a key the bank does not know", () => {
    const [candidate] = toIdentifyCandidates(index, labels, [
      { key: "abcdef1234", artKey: "art-3" },
    ]);
    expect(candidate?.name).toBeNull();
    expect(candidate?.detail).toBe("");
    expect(candidate?.landscape).toBe(false);
  });
});

describe("scanKeyName", () => {
  it("prefers the catalogue's display name for a legend", () => {
    expect(scanKeyName(index, labels, "key-legend")).toBe("Sett, Kingpin");
  });

  it("falls back to the bank label for a render the catalogue lacks", () => {
    expect(scanKeyName(index, labels, "key-portrait")).toBe("Yasuo");
  });

  it("has no name for an unlabelled key", () => {
    expect(scanKeyName(index, labels, "missing")).toBeNull();
  });
});
