import { describe, expect, it } from "vitest";

import { localeBannerDecision } from "./locale-banner";

const base = { active: "en", hasCookie: false, browserTags: [], dismissed: false } as const;

describe("localeBannerDecision", () => {
  it("suggests a supported language listed after English", () => {
    expect(localeBannerDecision({ ...base, browserTags: ["en-US", "de-DE"] })).toEqual({
      kind: "suggest",
      locale: "de",
    });
  });

  it("resolves Chinese regions to the matching script", () => {
    expect(localeBannerDecision({ ...base, browserTags: ["en", "zh-TW"] })).toEqual({
      kind: "suggest",
      locale: "zh-Hant",
    });
  });

  it("skips unsupported languages when picking a suggestion", () => {
    expect(localeBannerDecision({ ...base, browserTags: ["en", "es", "fr-CA"] })).toEqual({
      kind: "suggest",
      locale: "fr",
    });
  });

  it("hides when the browser only lists English or unsupported languages", () => {
    expect(localeBannerDecision({ ...base, browserTags: ["en-GB", "es"] })).toEqual({
      kind: "hide",
    });
    expect(localeBannerDecision({ ...base, browserTags: [] })).toEqual({ kind: "hide" });
  });

  it("hides when a supported language comes before English", () => {
    expect(localeBannerDecision({ ...base, browserTags: ["es", "de", "en"] })).toEqual({
      kind: "hide",
    });
  });

  it("hides the suggestion once a language was chosen", () => {
    expect(localeBannerDecision({ ...base, hasCookie: true, browserTags: ["en", "de"] })).toEqual({
      kind: "hide",
    });
  });

  it("notices a translated locale", () => {
    expect(localeBannerDecision({ ...base, active: "ko", hasCookie: true })).toEqual({
      kind: "notice",
      locale: "ko",
    });
  });

  it("hides everything after a dismissal", () => {
    expect(localeBannerDecision({ ...base, dismissed: true, browserTags: ["en", "de"] })).toEqual({
      kind: "hide",
    });
    expect(localeBannerDecision({ ...base, dismissed: true, active: "de" })).toEqual({
      kind: "hide",
    });
  });
});
