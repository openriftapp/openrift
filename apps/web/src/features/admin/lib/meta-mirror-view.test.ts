import { describe, expect, it } from "vitest";

import type { MirrorCounts } from "./meta-mirror-view";
import {
  autoPublishRuleSentence,
  findRailItem,
  mirrorRail,
  mirrorViewFromSearch,
  mirrorViewSearch,
} from "./meta-mirror-view";

const COUNTS: MirrorCounts = {
  needsDecision: 2,
  passingNoResults: 2,
  skippedUpcoming: 8833,
  skippedPast: 246_948,
  notStarted: 5,
  collecting: 686,
  final: 47_225,
  noResults: 604,
  undecided: 255_785,
  published: 48_520,
  rejected: 0,
  total: 304_305,
};

const RULE = { autoAcceptMinPlayers: 16, autoAcceptOfficial: true, autoAcceptNotable: false };

describe("mirrorRail", () => {
  it("lists every bucket under the place it belongs to, with its count", () => {
    const rail = mirrorRail(COUNTS, true);

    expect(rail.map((group) => [group.item.label, group.item.count])).toEqual([
      ["Undecided", 255_785],
      ["Published", 48_520],
      ["Rejected", 0],
      ["All events", 304_305],
    ]);
    expect(rail[0]!.children.map((item) => [item.id, item.count])).toEqual([
      ["needsDecision", 2],
      ["passingNoResults", 2],
      ["skippedUpcoming", 8833],
      ["skippedPast", 246_948],
    ]);
  });

  it("says n/a for collecting on a source that never collects", () => {
    const published = mirrorRail(COUNTS, false)[1]!;

    expect(published.children.find((item) => item.id === "collecting")?.count).toBeNull();
    expect(published.children.find((item) => item.id === "final")?.count).toBe(47_225);
  });
});

describe("mirror views", () => {
  it("opens on the events that need a decision", () => {
    expect(mirrorViewFromSearch({})).toEqual({ triage: "new", bucket: "needsDecision" });
  });

  it("derives the triage from a bucket", () => {
    expect(mirrorViewFromSearch({ triage: "new", bucket: "collecting" })).toEqual({
      triage: "accepted",
      bucket: "collecting",
    });
  });

  it("keeps a plain triage link from the health card", () => {
    expect(mirrorViewFromSearch({ triage: "accepted" })).toEqual({ triage: "accepted" });
  });

  it("writes only one of triage and bucket to the URL", () => {
    expect(mirrorViewSearch({ triage: "accepted", bucket: "final" })).toEqual({
      triage: undefined,
      bucket: "final",
    });
    expect(mirrorViewSearch({ triage: "dismissed" })).toEqual({
      triage: "dismissed",
      bucket: undefined,
    });
  });

  it("finds the rail item a view selects", () => {
    const rail = mirrorRail(COUNTS, true);

    expect(findRailItem(rail, { triage: "accepted", bucket: "noResults" })?.label).toBe(
      "No results",
    );
    expect(findRailItem(rail, { triage: "any" })?.label).toBe("All events");
  });
});

describe("autoPublishRuleSentence", () => {
  it("builds each source's rule from the stored settings", () => {
    expect(autoPublishRuleSentence("uvsgames", RULE)).toBe(
      "Auto-publish: 16+ players or a watched event type, with a mapped format. Cancelled events never publish.",
    );
    expect(autoPublishRuleSentence("playloltcg", RULE)).toBe("Auto-publish: 16+ players.");
    expect(autoPublishRuleSentence("topdeck", RULE)).toBe(
      "Auto-publish: 16+ players, solo events only.",
    );
    expect(autoPublishRuleSentence("playriftbound", RULE)).toBe(
      "Auto-publish: 16+ registrations, solo events only.",
    );
  });

  it("names every rule that is on for the source that has them", () => {
    expect(
      autoPublishRuleSentence("uvsgames", {
        autoAcceptMinPlayers: null,
        autoAcceptOfficial: true,
        autoAcceptNotable: true,
      }),
    ).toBe(
      "Auto-publish: a watched event type or a notable name, with a mapped format. Cancelled events never publish.",
    );
  });

  it("says the rule is off when no part of it applies", () => {
    const off = { autoAcceptMinPlayers: null, autoAcceptOfficial: true, autoAcceptNotable: false };
    expect(autoPublishRuleSentence("playriftbound", off)).toBe("Auto-publish is off.");
  });
});
