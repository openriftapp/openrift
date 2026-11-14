import { describe, expect, it } from "vitest";

import { checkBenchArgv } from "./bench-argv";

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
