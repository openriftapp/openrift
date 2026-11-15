import { describe, expect, it } from "vitest";

import { checkBenchArgv, checkScanArgv, scanScriptArgs } from "./bench-argv";

const spec = { values: ["--clip", "--set"], flags: ["--verbose"] };

describe("checkBenchArgv", () => {
  it("accepts known flags and value flags with their values", () => {
    expect(
      checkBenchArgv(["--clip", "a", "--verbose", "--set", "topK=4", "--set", "sweep=false"], spec),
    ).toEqual({ kind: "run" });
    expect(checkBenchArgv([], spec)).toEqual({ kind: "run" });
  });

  it("asks for help on --help or -h, even next to an unknown flag", () => {
    expect(checkBenchArgv(["--help"], spec)).toEqual({ kind: "help" });
    expect(checkBenchArgv(["--nope", "-h"], spec)).toEqual({ kind: "help" });
  });

  it("rejects an unknown flag and a stray positional", () => {
    expect(checkBenchArgv(["--verbos"], spec)).toEqual({
      kind: "invalid",
      message: "unknown argument --verbos",
    });
    expect(checkBenchArgv(["clip-a"], spec)).toEqual({
      kind: "invalid",
      message: "unknown argument clip-a",
    });
  });

  it("rejects a value flag with no value or a flag in its place", () => {
    expect(checkBenchArgv(["--clip"], spec)).toEqual({
      kind: "invalid",
      message: "--clip needs a value",
    });
    expect(checkBenchArgv(["--clip", "--verbose"], spec)).toEqual({
      kind: "invalid",
      message: "--clip needs a value",
    });
  });
});

describe("scanScriptArgs", () => {
  it("names the scan script and keeps the arguments after it", () => {
    expect(
      scanScriptArgs(["/usr/bin/bun", "/repo/scripts/scan/run-clips.ts", "--clip", "a"]),
    ).toEqual({ script: "run-clips", args: ["--clip", "a"] });
  });

  it("reads a Windows path", () => {
    expect(scanScriptArgs(["bun", String.raw`C:\repo\scripts\scan\compare-runs.ts`, "x"])).toEqual({
      script: "compare-runs",
      args: ["x"],
    });
  });

  it("returns no script name and every argument when no scan script is on the line", () => {
    expect(scanScriptArgs(["bun", "other.ts", "--help"])).toEqual({
      script: "",
      args: ["bun", "other.ts", "--help"],
    });
  });
});

describe("checkScanArgv", () => {
  it("splits positionals from flags and flag values", () => {
    expect(checkScanArgv(["a.json", "--clip", "b", "--verbose", "c.json"], spec, 2)).toEqual({
      check: { kind: "run" },
      positionals: ["a.json", "c.json"],
    });
  });

  it("rejects a positional past the script's count", () => {
    expect(checkScanArgv(["a.json", "b.json"], spec, 1)).toEqual({
      check: { kind: "invalid", message: "unexpected argument b.json" },
      positionals: ["a.json", "b.json"],
    });
  });

  it("reports a bad flag before an extra positional", () => {
    expect(checkScanArgv(["a.json", "--nope"], spec, 0).check).toEqual({
      kind: "invalid",
      message: "unknown argument --nope",
    });
  });

  it("asks for help even with extra positionals", () => {
    expect(checkScanArgv(["a.json", "--help"], spec, 0).check).toEqual({ kind: "help" });
  });
});
