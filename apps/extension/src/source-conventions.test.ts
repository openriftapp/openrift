import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const SRC = import.meta.dirname;

function filesMatching(pattern: RegExp): string[] {
  return readdirSync(SRC, { recursive: true, encoding: "utf-8" })
    .filter((file) => /\.tsx?$/u.test(file) && !/\.test\.tsx?$/u.test(file))
    .filter((file) => pattern.test(readFileSync(path.join(SRC, file), "utf-8")));
}

describe("generic helpers", () => {
  it("reads thrown errors only through the shared error helpers", () => {
    expect(
      filesMatching(/instanceof Error \? \w+\.message\b|instanceof Error \? \w+ : new Error\(/u),
    ).toEqual([]);
  });

  it("pluralizes through the shared pluralize and countNoun", () => {
    expect(
      filesMatching(/(?:[=!]==|>) 1 \? "s?" : "s?"|(?:[=!]==|>) 1 \? "[a-z]+" : "[a-z]+"/u),
    ).toEqual([]);
  });

  it("takes minute, hour and day lengths from the shared date module", () => {
    expect(
      filesMatching(
        /\b(?:24 \* 60 \* 60 \* 1000|60 \* 60 \* 1000|86_?400_?000|3_?600_?000)\b|const (?:MINUTE_MS|HOUR_MS|DAY_MS)\b/u,
      ),
    ).toEqual([]);
  });

  it("waits only through the shared sleep", () => {
    expect(filesMatching(/setTimeout\(resolve, \w+\)/u)).toEqual([]);
  });
});
