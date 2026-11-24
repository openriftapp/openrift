// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { readAsDataUrl } from "./read-as-data-url";

describe("readAsDataUrl", () => {
  it("reads a blob into a data URL", async () => {
    const blob = new Blob(["hello"], { type: "text/plain" });
    const result = await readAsDataUrl(blob);
    expect(result.startsWith("data:")).toBe(true);
  });
});
