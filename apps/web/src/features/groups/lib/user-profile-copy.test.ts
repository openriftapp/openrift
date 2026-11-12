import { describe, expect, it } from "vitest";

import {
  bestFinishHint,
  contributionsHint,
  groupsInCommonLabel,
  lastActiveLabel,
} from "./user-profile-copy";

describe("contributionsHint", () => {
  it("lists only the non-zero kinds with the right plurals", () => {
    expect(
      contributionsHint({ total: 13, cardFixes: 9, newCards: 0, photos: 1, metaEvents: 3 }),
    ).toBe("9 card fixes · 1 photo · 3 meta events");
    expect(
      contributionsHint({ total: 1, cardFixes: 1, newCards: 0, photos: 0, metaEvents: 0 }),
    ).toBe("1 card fix");
  });

  it("returns null when nothing was accepted", () => {
    expect(
      contributionsHint({ total: 0, cardFixes: 0, newCards: 0, photos: 0, metaEvents: 0 }),
    ).toBeNull();
  });
});

describe("bestFinishHint", () => {
  it("spells out the rank and the field", () => {
    expect(bestFinishHint({ rank: 2, players: 16 })).toBe("Best finish: 2nd of 16");
    expect(bestFinishHint(null)).toBeNull();
  });
});

describe("lastActiveLabel", () => {
  it("maps every bucket to copy", () => {
    expect(lastActiveLabel("today")).toBe("Active today");
    expect(lastActiveLabel("older")).toBe("Last active a while ago");
  });
});

describe("groupsInCommonLabel", () => {
  it("names one or two groups and counts the rest", () => {
    expect(groupsInCommonLabel([])).toBeNull();
    expect(groupsInCommonLabel(["Rift Rats"])).toBe("In Rift Rats with you");
    expect(groupsInCommonLabel(["Rift Rats", "Piltover Pals"])).toBe(
      "In Rift Rats and Piltover Pals with you",
    );
    expect(groupsInCommonLabel(["Rift Rats", "Piltover Pals", "Zaun Crew"])).toBe(
      "In Rift Rats and 2 other groups with you",
    );
  });
});
