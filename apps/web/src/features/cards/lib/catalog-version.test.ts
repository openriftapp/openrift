import { describe, expect, it } from "vitest";

import { versionFromEtag } from "./catalog-version";

describe("versionFromEtag", () => {
  it("strips surrounding quotes from a strong ETag", () => {
    expect(versionFromEtag('"abc123"')).toBe("abc123");
  });

  it("strips the weak prefix and quotes", () => {
    expect(versionFromEtag('W/"abc123"')).toBe("abc123");
  });

  it("passes through an unquoted value", () => {
    expect(versionFromEtag("abc123")).toBe("abc123");
  });

  it("returns null for a missing header", () => {
    expect(versionFromEtag(null)).toBeNull();
  });

  it("returns null for an empty or quotes-only header", () => {
    expect(versionFromEtag("")).toBeNull();
    expect(versionFromEtag('""')).toBeNull();
  });
});
