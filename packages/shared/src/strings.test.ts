import { describe, expect, it } from "vitest";

import {
  capitalize,
  emptyToNull,
  errorMessage,
  escapeHtml,
  isUuid,
  pluralize,
  sentenceCaseSlug,
  slugifyName,
  straightenApostrophes,
  stringifyUnknown,
  titleCaseSlug,
  toError,
  trimToNull,
  truncateWithEllipsis,
} from "./strings.js";

describe("straightenApostrophes", () => {
  it("replaces curly apostrophes with straight ones", () => {
    expect(straightenApostrophes("Kai’Sa, Survivor")).toBe("Kai'Sa, Survivor");
  });

  it("replaces every occurrence", () => {
    expect(straightenApostrophes("don’t ’cause it’s")).toBe("don't 'cause it's");
  });

  it("leaves straight apostrophes unchanged", () => {
    expect(straightenApostrophes("Kai'Sa")).toBe("Kai'Sa");
  });

  it("leaves text without any apostrophes unchanged", () => {
    expect(straightenApostrophes("Fireball")).toBe("Fireball");
  });

  it("returns an empty string unchanged", () => {
    expect(straightenApostrophes("")).toBe("");
  });
});

describe("emptyToNull", () => {
  it("returns null for empty string", () => {
    expect(emptyToNull("")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(emptyToNull(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(emptyToNull(undefined)).toBeNull();
  });

  it("returns the string for non-empty input", () => {
    expect(emptyToNull("hello")).toBe("hello");
  });

  it("returns the string for whitespace-only input", () => {
    expect(emptyToNull("  ")).toBe("  ");
  });
});

describe("trimToNull", () => {
  it("returns null for whitespace-only input", () => {
    expect(trimToNull("   ")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(trimToNull("")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(trimToNull(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(trimToNull(undefined)).toBeNull();
  });

  it("trims surrounding whitespace but preserves inner spacing", () => {
    expect(trimToNull("  hello world  ")).toBe("hello world");
  });
});

describe("capitalize", () => {
  it("uppercases the first character", () => {
    expect(capitalize("regions")).toBe("Regions");
  });

  it("leaves an empty string alone", () => {
    expect(capitalize("")).toBe("");
  });
});

describe("sentenceCaseSlug", () => {
  it("capitalizes only the first word", () => {
    expect(sentenceCaseSlug("constructed")).toBe("Constructed");
    expect(sentenceCaseSlug("custom-region")).toBe("Custom region");
  });

  it("treats underscores as word separators too", () => {
    expect(sentenceCaseSlug("custom_region")).toBe("Custom region");
  });

  it("drops empty segments from a doubled or trailing separator", () => {
    expect(sentenceCaseSlug("custom--region-")).toBe("Custom region");
  });
});

describe("titleCaseSlug", () => {
  it("capitalizes every word of a hyphenated slug", () => {
    expect(titleCaseSlug("proving-grounds")).toBe("Proving Grounds");
  });

  it("capitalizes every word of an underscored slug", () => {
    expect(titleCaseSlug("rainbow_foil")).toBe("Rainbow Foil");
    expect(titleCaseSlug("metal-deluxe")).toBe("Metal Deluxe");
  });

  it("returns an empty string for an empty slug", () => {
    expect(titleCaseSlug("")).toBe("");
  });
});

describe("truncateWithEllipsis", () => {
  it("leaves text within the budget untouched", () => {
    expect(truncateWithEllipsis("Yasuo", 10)).toBe("Yasuo");
    expect(truncateWithEllipsis("Yasuo", 5)).toBe("Yasuo");
  });

  it("counts the ellipsis against the budget", () => {
    expect(truncateWithEllipsis("Yasuo", 4)).toBe("Yas…");
  });

  it("trims trailing space before the ellipsis", () => {
    expect(truncateWithEllipsis("Yasuo Unforgiven", 7)).toBe("Yasuo…");
  });

  it("returns an empty string for a non-positive budget", () => {
    expect(truncateWithEllipsis("Yasuo", 0)).toBe("");
    expect(truncateWithEllipsis("Yasuo", -1)).toBe("");
  });
});

describe("stringifyUnknown", () => {
  it("returns a string unchanged and renders other primitives", () => {
    expect(stringifyUnknown("already text")).toBe("already text");
    expect(stringifyUnknown(42)).toBe("42");
    expect(stringifyUnknown(true)).toBe("true");
    expect(stringifyUnknown(9n)).toBe("9");
  });

  it("renders an object as JSON rather than [object Object]", () => {
    expect(stringifyUnknown({ a: 1 })).toBe('{"a":1}');
    expect(stringifyUnknown([1, "two"])).toBe('[1,"two"]');
  });

  it("names null and undefined", () => {
    expect(stringifyUnknown(null)).toBe("null");
    expect(stringifyUnknown(undefined)).toBe("undefined");
  });

  it("returns an empty string for a value JSON cannot represent", () => {
    expect(stringifyUnknown(Symbol("s"))).toBe("");
    expect(stringifyUnknown(() => undefined)).toBe("");
  });
});

describe("slugifyName", () => {
  it("lowercases and joins words with dashes", () => {
    expect(slugifyName("  Kai'Sa, Survivor! ")).toBe("kai-sa-survivor");
  });

  it("drops accented letters unless folding is requested", () => {
    expect(slugifyName("Café Ñandú")).toBe("caf-and");
    expect(slugifyName("Café Ñandú", { foldDiacritics: true })).toBe("cafe-nandu");
  });

  it("returns an empty string when nothing is left", () => {
    expect(slugifyName("---")).toBe("");
  });
});

describe("escapeHtml", () => {
  it("escapes markup and quotes", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });

  it("leaves plain text alone", () => {
    expect(escapeHtml("plain")).toBe("plain");
  });
});

describe("pluralize", () => {
  it("picks singular only for exactly one", () => {
    expect(pluralize(1, "card")).toBe("card");
    expect(pluralize(0, "card")).toBe("cards");
    expect(pluralize(2, "card")).toBe("cards");
  });

  it("uses an explicit plural", () => {
    expect(pluralize(2, "copy", "copies")).toBe("copies");
  });
});

describe("toError / errorMessage", () => {
  it("passes an Error through", () => {
    const error = new Error("boom");
    expect(toError(error)).toBe(error);
    expect(errorMessage(error)).toBe("boom");
  });

  it("wraps non-Error values", () => {
    expect(toError("bad").message).toBe("bad");
    expect(errorMessage(42)).toBe("42");
    expect(errorMessage(null)).toBe("null");
  });
});

describe("isUuid", () => {
  it("accepts a uuid in either case", () => {
    expect(isUuid("0190b4a0-1c2d-7e3f-8a4b-5c6d7e8f9a0b")).toBe(true);
    expect(isUuid("0190B4A0-1C2D-7E3F-8A4B-5C6D7E8F9A0B")).toBe(true);
  });

  it("rejects slugs and malformed values", () => {
    expect(isUuid("my-org")).toBe(false);
    expect(isUuid("0190b4a0-1c2d-7e3f-8a4b-5c6d7e8f9a0")).toBe(false);
    expect(isUuid("")).toBe(false);
  });
});
