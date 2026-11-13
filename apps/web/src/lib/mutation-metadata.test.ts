import { describe, expect, it } from "vitest";

import { mutationTag } from "./mutation-metadata";

describe("mutationTag", () => {
  it("reads back the value a metadata object was tagged with", () => {
    const reorder = mutationTag<string[]>();
    const metadata = reorder.tag(["a", "b"]);
    expect(reorder.read(metadata)).toEqual(["a", "b"]);
  });

  it("reads nothing from metadata another tag made", () => {
    const reorder = mutationTag<string[]>();
    const patch = mutationTag<{ name: string }>();
    expect(reorder.read(patch.tag({ name: "Ahri Mid" }))).toBeUndefined();
  });

  it("reads nothing from missing or primitive metadata", () => {
    const reorder = mutationTag<string[]>();
    expect(reorder.read(undefined)).toBeUndefined();
    expect(reorder.read("batch-1")).toBeUndefined();
  });
});
