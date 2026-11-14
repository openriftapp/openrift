import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const COMPONENTS = path.join(import.meta.dirname, "components");

const FINISHED_LAYER = /animate-[a-z-]+-(?:after|now|in|live)\b/u;
const HIDDEN_BASE = /(?:^|\s)(?:opacity-0|grid-rows-\[0fr\])(?:\s|$)/u;
const CLASS_STRING = /"(?<classes>[^"\n]*)"/gu;

function vignetteFiles(): string[] {
  return readdirSync(COMPONENTS).filter(
    (file) => file.includes("vignette") && file.endsWith(".tsx") && !file.endsWith(".test.tsx"),
  );
}

describe("vignette motion", () => {
  it("keeps every finished layer visible when motion is reduced", () => {
    const offenders = vignetteFiles().flatMap((file) =>
      [...readFileSync(path.join(COMPONENTS, file), "utf-8").matchAll(CLASS_STRING)]
        .map((match) => match.groups?.classes ?? "")
        .filter((classes) => FINISHED_LAYER.test(classes) && HIDDEN_BASE.test(classes))
        .map((classes) => `${file}: ${classes}`),
    );

    expect(offenders).toEqual([]);
  });
});
