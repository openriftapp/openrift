import { describe, expect, it } from "vitest";

import { parsePromoAnnouncement } from "./promo-announcement";

describe("parsePromoAnnouncement", () => {
  it("splits date, link, quote and trailing note", () => {
    const result = parsePromoAnnouncement(
      'Announced [2025-10-06](https://example.com/news/a). "Get yours while supplies last!" In China it also went out at events.',
    );
    expect(result).toEqual({
      date: "2025-10-06",
      url: "https://example.com/news/a",
      quote: "Get yours while supplies last!",
      note: "In China it also went out at events.",
    });
  });

  it("handles curly quotes and a quote with nothing after it", () => {
    const result = parsePromoAnnouncement(
      "Announced [2025-10-06](https://example.com/a). “All participants receive a pack.”",
    );
    expect(result.quote).toBe("All participants receive a pack.");
    expect(result.note).toBeNull();
  });

  it("keeps inner quote marks that are not followed by whitespace", () => {
    const result = parsePromoAnnouncement(
      'Announced [2025-10-06](https://example.com/a). "Say "hi", then go." Done.',
    );
    expect(result.quote).toBe('Say "hi", then go.');
    expect(result.note).toBe("Done.");
  });

  it("allows a date without a link", () => {
    const result = parsePromoAnnouncement('Announced 2025-10-06. "Hello."');
    expect(result.date).toEqual("2025-10-06");
    expect(result.url).toBeNull();
    expect(result.quote).toBe("Hello.");
  });

  it("keeps a note with no quote", () => {
    const result = parsePromoAnnouncement("Announced [2025-10-06](https://example.com/a). Later.");
    expect(result.quote).toBeNull();
    expect(result.note).toBe("Later.");
  });

  it("returns text without the lead-in whole as the note", () => {
    expect(parsePromoAnnouncement("2026-02-06 to 2026-02-12.")).toEqual({
      date: null,
      url: null,
      quote: null,
      note: "2026-02-06 to 2026-02-12.",
    });
  });

  it("drops an impossible calendar date", () => {
    expect(parsePromoAnnouncement("Announced 2025-13-40.").date).toBeNull();
  });
});
