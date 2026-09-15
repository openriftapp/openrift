import { emptyBoardDocument } from "@openrift/shared/board-state";
import type { FeaturedBoardStateResponse } from "@openrift/shared/types/api/board-state";
import { describe, expect, it } from "vitest";

import { buildRuleExamplesMap } from "./rule-examples";

function makeItem(overrides: Partial<FeaturedBoardStateResponse> = {}): FeaturedBoardStateResponse {
  return {
    id: "board-1",
    shareToken: "tok-1",
    title: "Example board",
    answer: null,
    coreRulesVersion: "2026-07-16",
    tournamentRulesVersion: null,
    document: emptyBoardDocument(),
    isFeatured: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildRuleExamplesMap", () => {
  it("includes an item only for its exact rules version", () => {
    const item = makeItem({ answer: "See [[460.3]].", coreRulesVersion: "2026-07-16" });
    expect(buildRuleExamplesMap([item], "core", "2026-07-16").has("460.3")).toBe(true);
    expect(buildRuleExamplesMap([item], "core", "2026-01-01").has("460.3")).toBe(false);
  });

  it("includes an item only for its rules kind", () => {
    const item = makeItem({
      answer: "See [[460.3]].",
      coreRulesVersion: "2026-07-16",
      tournamentRulesVersion: "2026-07-16",
    });
    expect(buildRuleExamplesMap([item], "core", "2026-07-16").has("460.3")).toBe(true);
    expect(buildRuleExamplesMap([item], "tournament", "2026-07-16").has("460.3")).toBe(false);
  });

  it("does not match when the ref's kind has a null pin", () => {
    const item = makeItem({
      answer: "See [[t:460.3]].",
      coreRulesVersion: "2026-07-16",
      tournamentRulesVersion: null,
    });
    expect(buildRuleExamplesMap([item], "tournament", "2026-07-16").has("460.3")).toBe(false);
    expect(buildRuleExamplesMap([item], "core", "2026-07-16").size).toBe(0);
  });

  it("dedups the same board referenced twice by one rule", () => {
    const item = makeItem({
      answer: "See [[460.3]].",
      coreRulesVersion: "2026-07-16",
      document: {
        ...emptyBoardDocument(),
        steps: [
          { caption: "Step one, [[460.3]] applies.", pieces: [], chain: [], arrows: [] },
          { caption: "Step two, still [[460.3]].", pieces: [], chain: [], arrows: [] },
        ],
      },
    });
    const examples = buildRuleExamplesMap([item], "core", "2026-07-16").get("460.3");
    expect(examples).toHaveLength(1);
    expect(examples?.[0]?.shareToken).toBe("tok-1");
  });

  it("collects refs from the answer and from all step captions", () => {
    const item = makeItem({
      answer: "See [[100.1]].",
      coreRulesVersion: "2026-07-16",
      document: {
        ...emptyBoardDocument(),
        steps: [
          { caption: "First [[200.2]].", pieces: [], chain: [], arrows: [] },
          { caption: "Second [[300.3]].", pieces: [], chain: [], arrows: [] },
        ],
      },
    });
    const map = buildRuleExamplesMap([item], "core", "2026-07-16");
    expect([...map.keys()].toSorted()).toEqual(["100.1", "200.2", "300.3"]);
  });

  it("returns an empty map when no captions or answer reference a rule", () => {
    const item = makeItem({ answer: null, coreRulesVersion: "2026-07-16" });
    const map = buildRuleExamplesMap([item], "core", "2026-07-16");
    expect(map.size).toBe(0);
  });
});
