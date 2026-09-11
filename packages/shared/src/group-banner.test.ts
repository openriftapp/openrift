import { describe, expect, it } from "vitest";

import { isGroupBannerUrl } from "./group-banner.js";

describe("isGroupBannerUrl", () => {
  it("accepts a stored banner path", () => {
    expect(isGroupBannerUrl("/media/group-banners/0199251c-5f1a-7000-8000-00000000000a.webp")).toBe(
      true,
    );
  });

  it("rejects another media directory, another extension, and a traversal", () => {
    expect(isGroupBannerUrl("/media/submissions/0199251c-5f1a-7000-8000-00000000000a.jpg")).toBe(
      false,
    );
    expect(isGroupBannerUrl("/media/group-banners/0199251c-5f1a-7000-8000-00000000000a.jpg")).toBe(
      false,
    );
    expect(isGroupBannerUrl("/media/group-banners/../cards/01.webp")).toBe(false);
    expect(isGroupBannerUrl("https://example.test/banner.webp")).toBe(false);
  });
});
