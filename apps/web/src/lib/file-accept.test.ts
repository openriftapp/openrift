import { describe, expect, it } from "vitest";

import { matchesAccept } from "./file-accept";

const png = { name: "card.PNG", type: "image/png" };
const pdf = { name: "rules.pdf", type: "application/pdf" };

describe("matchesAccept", () => {
  it("accepts everything without an accept list", () => {
    expect(matchesAccept(pdf)).toBe(true);
    expect(matchesAccept(pdf, " ")).toBe(true);
  });

  it("matches a wildcard MIME type", () => {
    expect(matchesAccept(png, "image/*")).toBe(true);
    expect(matchesAccept(pdf, "image/*")).toBe(false);
  });

  it("matches an exact MIME type", () => {
    expect(matchesAccept(png, "image/webp, image/png")).toBe(true);
    expect(matchesAccept(png, "image/webp")).toBe(false);
  });

  it("matches an extension regardless of case", () => {
    expect(matchesAccept(png, ".jpg,.png")).toBe(true);
    expect(matchesAccept(pdf, ".jpg,.png")).toBe(false);
  });

  it("rejects a file with no type against a MIME list", () => {
    expect(matchesAccept({ name: "blob", type: "" }, "image/*")).toBe(false);
  });
});
