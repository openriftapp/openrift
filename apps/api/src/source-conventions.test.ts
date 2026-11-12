import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const SRC = import.meta.dirname;

function sourceFiles(dir: string): string[] {
  return readdirSync(path.join(SRC, dir), { recursive: true, encoding: "utf-8" })
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .map((file) => path.join(dir, file));
}

function filesMatching(dir: string, pattern: RegExp, allowed: string[]): string[] {
  return sourceFiles(dir).filter(
    (file) => !allowed.includes(file) && pattern.test(readFileSync(path.join(SRC, file), "utf-8")),
  );
}

describe("source conventions", () => {
  it("creates printings only through insertNewPrinting", () => {
    const offenders = filesMatching("modules", /\.insertPrinting\(/u, [
      "modules/catalog/services/printing-admin.ts",
    ]);

    expect(offenders).toEqual([]);
  });

  it("sends meta source HTTP only through paced-http", () => {
    const offenders = filesMatching("modules/meta", /\bfetch\(/u, [
      "modules/meta/services/meta-sync/paced-http.ts",
    ]);

    expect(offenders).toEqual([]);
  });

  it("keeps day and hour constants in meta-durations", () => {
    const offenders = filesMatching("modules/meta", /const (?:DAY_MS|MS_PER_DAY|HOUR_MS)\b/u, [
      "modules/meta/lib/meta-durations.ts",
    ]);

    expect(offenders).toEqual([]);
  });
});
