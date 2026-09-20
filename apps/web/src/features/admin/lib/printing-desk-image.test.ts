import { describe, expect, it } from "vitest";

import { deskImageBust, deskImageSrc } from "./printing-desk-image";

describe("deskImageSrc", () => {
  it("appends the variant to a rehosted path", () => {
    expect(deskImageSrc("/media/cards/40/abc-40", "240w")).toBe("/media/cards/40/abc-40-240w.webp");
  });

  it("appends the cache key to a rehosted path", () => {
    expect(deskImageSrc("/media/cards/40/abc-40", "240w", "r=90&q=0")).toBe(
      "/media/cards/40/abc-40-240w.webp?r=90&q=0",
    );
  });

  it("leaves a source URL free of the cache key", () => {
    expect(deskImageSrc("https://example.com/card.png", "full", "r=90&q=0")).toBe(
      "https://example.com/card.png",
    );
  });

  it("returns a source URL unchanged", () => {
    expect(deskImageSrc("https://example.com/card.png", "full")).toBe(
      "https://example.com/card.png",
    );
  });

  it("passes null through", () => {
    expect(deskImageSrc(null, "120w")).toBeNull();
  });
});

describe("deskImageBust", () => {
  const quad = [
    { x: 10, y: 12 },
    { x: 200, y: 12 },
    { x: 200, y: 280 },
    { x: 10, y: 280 },
  ] as const;

  it("changes when the corners change", () => {
    const set = deskImageBust({ rotation: 0, quad: [...quad] });
    expect(set).not.toBe(deskImageBust({ rotation: 0, quad: null }));
  });

  it("changes when the rotation changes", () => {
    expect(deskImageBust({ rotation: 0, quad: null })).not.toBe(
      deskImageBust({ rotation: 90, quad: null }),
    );
  });
});
