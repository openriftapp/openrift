import { describe, expect, it } from "vitest";

import { isChromaGround } from "@/features/stage/lib/chroma-ground";

describe("isChromaGround", () => {
  it("treats green and magenta as chroma grounds", () => {
    expect(isChromaGround("green")).toBe(true);
    expect(isChromaGround("magenta")).toBe(true);
  });

  it("treats black as a plain ground", () => {
    expect(isChromaGround("black")).toBe(false);
  });
});
