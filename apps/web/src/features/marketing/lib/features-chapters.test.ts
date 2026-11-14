import { describe, expect, it } from "vitest";

import { featureChapters } from "./features-chapters";

function labels(scanner: boolean): string[] {
  return featureChapters({ scanner }).flatMap((chapter) => chapter.features);
}

describe("featureChapters", () => {
  it("lists the scanner only while the scanner is on", () => {
    expect(labels(true)).toContain("Scanner");
    expect(labels(false)).not.toContain("Scanner");
  });
});
