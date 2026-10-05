import { describe, expect, it } from "vitest";

import { applySets, parseSets } from "./option-sets";

const defaults = {
  topK: 8,
  sweep: true,
  accept: { lockRun: 4, maxGapFrames: 6 },
};

describe("parseSets", () => {
  it("collects every --set in argv order", () => {
    expect(parseSets(["--set", "topK=4", "--clip", "x", "--set", "accept.lockRun=3"])).toEqual([
      { path: ["topK"], value: 4 },
      { path: ["accept", "lockRun"], value: 3 },
    ]);
  });

  it("parses booleans, null and Infinity", () => {
    expect(parseSets(["--set", "sweep=true"])[0]?.value).toBe(true);
    expect(parseSets(["--set", "sweep=false"])[0]?.value).toBe(false);
    expect(parseSets(["--set", "accept.lockRun=null"])[0]?.value).toBeNull();
    expect(parseSets(["--set", "accept.lockRun=Infinity"])[0]?.value).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it("rejects a missing path, an empty segment and a non-number", () => {
    expect(() => parseSets(["--set", "=4"])).toThrow("expected path=value");
    expect(() => parseSets(["--set", "topK"])).toThrow("expected path=value");
    expect(() => parseSets(["--set", "accept..lockRun=4"])).toThrow("expected path=value");
    expect(() => parseSets(["--set", "topK="])).toThrow("must be a number");
    expect(() => parseSets(["--set", "topK=four"])).toThrow("must be a number");
    expect(() => parseSets(["--set"])).toThrow("expected path=value");
  });
});

describe("applySets", () => {
  it("overrides a top-level and a nested value without mutating the inputs", () => {
    const plan = { topK: 4, accept: { lockRun: 3, maxGapFrames: 6 } };
    const merged = applySets(
      plan,
      defaults,
      parseSets(["--set", "topK=2", "--set", "accept.lockRun=1"]),
    );
    expect(merged).toEqual({ topK: 2, accept: { lockRun: 1, maxGapFrames: 6 } });
    expect(plan).toEqual({ topK: 4, accept: { lockRun: 3, maxGapFrames: 6 } });
    expect(defaults.accept.lockRun).toBe(4);
  });

  it("starts a group the plan leaves out from the defaults", () => {
    const merged = applySets({ topK: 4 }, defaults, parseSets(["--set", "accept.lockRun=2"]));
    expect(merged).toEqual({ topK: 4, accept: { lockRun: 2, maxGapFrames: 6 } });
  });

  it("restores the default on a top-level null", () => {
    const merged = applySets({ topK: 4 }, defaults, parseSets(["--set", "topK=null"]));
    expect(merged).toEqual({ topK: 8 });
  });

  it("restores the default inside a group on a nested null and keeps its siblings", () => {
    const merged = applySets(
      { accept: { lockRun: 1, maxGapFrames: 2 } },
      defaults,
      parseSets(["--set", "accept.lockRun=null"]),
    );
    expect(merged).toEqual({ accept: { lockRun: 4, maxGapFrames: 2 } });
  });

  it("restores a nested default in a group the plan leaves out", () => {
    const merged = applySets({}, defaults, parseSets(["--set", "accept.lockRun=null"]));
    expect(merged).toEqual({ accept: { lockRun: 4, maxGapFrames: 6 } });
  });

  it("deletes a key without a default on null", () => {
    const merged = applySets(
      { topK: 4, accept: { lockRun: 3, maxGapFrames: 6, weighted: true } },
      defaults,
      parseSets(["--set", "accept.weighted=null"]),
    );
    expect(merged).toEqual({ topK: 4, accept: { lockRun: 3, maxGapFrames: 6 } });
  });

  it("rejects a null for an option in neither the plan nor the defaults", () => {
    expect(() => applySets({}, defaults, parseSets(["--set", "nope=null"]))).toThrow(
      "no such option",
    );
  });

  it("rejects an unknown option, a scalar used as a group and a type mismatch", () => {
    expect(() => applySets({}, defaults, parseSets(["--set", "nope=1"]))).toThrow("no such option");
    expect(() => applySets({}, defaults, parseSets(["--set", "topK.x=1"]))).toThrow(
      "not an option group",
    );
    expect(() => applySets({}, defaults, parseSets(["--set", "topK=true"]))).toThrow(
      "expected a number",
    );
  });
});
