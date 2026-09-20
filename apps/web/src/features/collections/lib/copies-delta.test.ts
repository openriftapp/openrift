import { describe, expect, it } from "vitest";

import { mergeCopiesDelta } from "@/features/collections/lib/copies-delta";
import { stubCopy } from "@/test/factories";

describe("mergeCopiesDelta", () => {
  it("keeps untouched rows, replaces changed ones and drops deleted ones", () => {
    const previous = [
      stubCopy({ id: "c1", collectionId: "col-1" }),
      stubCopy({ id: "c2", collectionId: "col-1" }),
      stubCopy({ id: "c3", collectionId: "col-1" }),
    ];

    const merged = mergeCopiesDelta(
      previous,
      [stubCopy({ id: "c2", collectionId: "col-2" })],
      ["c3"],
    );

    expect(merged.map((row) => row.id).toSorted()).toEqual(["c1", "c2"]);
    expect(merged.find((row) => row.id === "c2")?.collectionId).toBe("col-2");
  });

  it("adds a row it has never seen", () => {
    const merged = mergeCopiesDelta([stubCopy({ id: "c1" })], [stubCopy({ id: "c2" })], []);

    expect(merged.map((row) => row.id).toSorted()).toEqual(["c1", "c2"]);
  });

  it("keeps a row that was re-added after its tombstone", () => {
    const merged = mergeCopiesDelta(
      [stubCopy({ id: "c1" })],
      [stubCopy({ id: "c1", collectionId: "col-2" })],
      ["c1"],
    );

    expect(merged.map((row) => row.id)).toEqual(["c1"]);
    expect(merged[0]?.collectionId).toBe("col-2");
  });

  it("returns the previous rows when nothing changed", () => {
    const previous = [stubCopy({ id: "c1" })];

    expect(mergeCopiesDelta(previous, [], [])).toEqual(previous);
  });
});
