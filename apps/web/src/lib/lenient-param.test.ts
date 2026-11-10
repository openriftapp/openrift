import { describe, expect, it } from "vitest";
import { z } from "zod/mini";

import { lenient } from "./lenient-param";

describe("lenient", () => {
  const schema = z.object({ n: lenient(z.number()), tags: lenient(z.array(z.string())) });

  it("keeps a valid value", () => {
    expect(schema.parse({ n: 3, tags: ["a"] })).toEqual({ n: 3, tags: ["a"] });
  });

  it("drops a malformed value without failing the object", () => {
    expect(schema.parse({ n: "3", tags: [1] })).toEqual({ n: undefined, tags: undefined });
  });

  it("leaves an absent key absent", () => {
    expect(schema.parse({})).toEqual({});
    expect("n" in schema.parse({})).toBe(false);
  });
});
