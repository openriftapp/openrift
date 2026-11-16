import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const SRC = path.resolve(import.meta.dirname, "..");

function sourceFiles(): string[] {
  return readdirSync(SRC, { recursive: true, encoding: "utf-8" }).filter(
    (file) => /\.tsx?$/u.test(file) && !/\.test\.tsx?$/u.test(file),
  );
}

describe("server cache", () => {
  it("never forwards the requester's cookie from a shared cache entry", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const source = readFileSync(path.join(SRC, file), "utf-8");
      for (const match of source.matchAll(/serverCache\.query\(\{[\s\S]*?queryFn:[^\n]*/gu)) {
        if (match[0].includes("cookie")) {
          offenders.push(file);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
