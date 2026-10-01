import type { ErrataEntry, ErrataListResponse } from "@openrift/shared/contracts/errata";
import { describe, expect, it } from "vitest";

import { errataContentVersion } from "./errata-share-image";

function entry(slug: string): ErrataEntry {
  return {
    announcementId: "a-1",
    source: null,
    sourceUrl: null,
    effectiveDate: null,
    correctedRulesText: "Draw a card.",
    correctedEffectText: null,
    card: { slug, name: slug, types: ["unit"], tags: [], domains: [] },
    printing: null,
  };
}

function data(entries: ErrataEntry[]): ErrataListResponse {
  return {
    announcements: [{ id: "a-1", name: "A", publishedOn: "2026-07-23", url: "https://x" }],
    sets: [],
    entries,
  };
}

describe("errataContentVersion", () => {
  it("is stable for the same content", () => {
    expect(errataContentVersion(data([entry("arise")]))).toBe(
      errataContentVersion(data([entry("arise")])),
    );
  });

  it("changes when an entry is added", () => {
    expect(errataContentVersion(data([entry("arise"), entry("gold")]))).not.toBe(
      errataContentVersion(data([entry("arise")])),
    );
  });
});
