import { describe, expect, it } from "vitest";

import { makeCandidatePrinting } from "@/test/factories";

import type { DraftCard } from "./creation-draft";
import {
  checkedGroupKeys,
  isDraftComplete,
  runInSequence,
  seedNewCardGroups,
} from "./new-card-groups";

const card: DraftCard = { mode: "new", slug: "viktor-herald", name: "Viktor, Herald", summary: "" };

function source(id: string, provider: string) {
  return { id, provider } as never;
}

function group(shortCodes: string[]) {
  return {
    mostCommonShortCode: "SFD-045",
    shortCodes,
    expectedPrintingId: "SFD-045",
    language: "EN",
    suggestedPrintingId: null,
  };
}

describe("seedNewCardGroups", () => {
  const order = (a: string, b: string) =>
    ["trusted", "other"].indexOf(a) - ["trusted", "other"].indexOf(b);

  it("seeds one draft per group from the first source by provider order", () => {
    const fromOther = makeCandidatePrinting({
      id: "p1",
      candidateCardId: "s-other",
      artist: "Other Artist",
    });
    const fromTrusted = makeCandidatePrinting({
      id: "p2",
      candidateCardId: "s-trusted",
      artist: "Trusted Artist",
    });
    const foil = makeCandidatePrinting({
      id: "p3",
      candidateCardId: "s-other",
      shortCode: "SFD-045a",
      publicCode: "SFD-045a/300",
      finish: "foil",
    });
    const groups = seedNewCardGroups(
      {
        sources: [source("s-other", "other"), source("s-trusted", "trusted")],
        candidatePrintings: [fromOther, fromTrusted, foil],
        candidatePrintingGroups: [group(["p1", "p2"]), group(["p3"])],
      },
      order,
      card,
    );
    expect(groups).toHaveLength(2);
    expect(groups[0]?.draft.faces[0]?.fields.artist).toBe("Trusted Artist");
    expect(groups[0]?.draft.candidatePrintingIds).toEqual(["p1", "p2"]);
    expect(groups[0]?.label).toBe("OGN-001 · EN · nonfoil (2 sources)");
    expect(groups[1]?.label).toBe("SFD-045a · EN · foil (1 source)");
  });

  it("skips a group whose candidates are missing", () => {
    const groups = seedNewCardGroups(
      { sources: [], candidatePrintings: [], candidatePrintingGroups: [group(["gone"])] },
      order,
      card,
    );
    expect(groups).toEqual([]);
  });
});

describe("checkedGroupKeys", () => {
  const complete = seedNewCardGroups(
    {
      sources: [source("s", "other")],
      candidatePrintings: [makeCandidatePrinting({ id: "ok", candidateCardId: "s" })],
      candidatePrintingGroups: [group(["ok"])],
    },
    () => 0,
    card,
  );
  const incomplete = seedNewCardGroups(
    {
      sources: [source("s", "other")],
      candidatePrintings: [makeCandidatePrinting({ id: "bad", candidateCardId: "s", artist: "" })],
      candidatePrintingGroups: [group(["bad"])],
    },
    () => 0,
    card,
  );
  const groups = [...complete, ...incomplete];

  it("checks complete groups by default and never incomplete ones", () => {
    expect(isDraftComplete(complete[0]!.draft)).toBe(true);
    expect(isDraftComplete(incomplete[0]!.draft)).toBe(false);
    expect(checkedGroupKeys(groups, new Map())).toEqual(["ok"]);
    expect(checkedGroupKeys(groups, new Map([["bad", true]]))).toEqual(["ok"]);
  });

  it("drops a group the admin unticked", () => {
    expect(checkedGroupKeys(groups, new Map([["ok", false]]))).toEqual([]);
  });
});

describe("runInSequence", () => {
  it("runs every item in order and reports each failure", async () => {
    const seen: number[] = [];
    const failures = await runInSequence([1, 2, 3], async (item) => {
      seen.push(item);
      if (item === 2) {
        throw new Error("conflict");
      }
    });
    expect(seen).toEqual([1, 2, 3]);
    expect(failures.map((failure) => failure.item)).toEqual([2]);
    expect(failures[0]?.error).toEqual(new Error("conflict"));
  });

  it("waits for each item before starting the next", async () => {
    const log: string[] = [];
    await runInSequence(["a", "b"], async (item) => {
      log.push(`start ${item}`);
      await Promise.resolve();
      log.push(`end ${item}`);
    });
    expect(log).toEqual(["start a", "end a", "start b", "end b"]);
  });
});
