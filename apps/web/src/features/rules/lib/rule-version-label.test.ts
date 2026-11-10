import { describe, expect, it } from "vitest";

import {
  ruleVersionLabel,
  ruleVersionLabels,
  rulesPhoneFacts,
  rulesSettingsLabel,
} from "./rule-version-label";

function entry(
  version: string,
  documentVersion: string | null = null,
  label: string | null = null,
) {
  return { version, documentVersion, label };
}

describe("ruleVersionLabel", () => {
  it("joins the document version and the set name, followed by the date", () => {
    expect(ruleVersionLabel(entry("2026-07-16", "1.4", "Vendetta"))).toBe(
      "1.4 · Vendetta (2026-07-16)",
    );
  });

  it("uses whichever of the two names is set", () => {
    expect(ruleVersionLabel(entry("2025-06-02", null, "Pre-Origins"))).toBe(
      "Pre-Origins (2025-06-02)",
    );
    expect(ruleVersionLabel(entry("2025-10-01", "1.1", null))).toBe("1.1 (2025-10-01)");
  });

  it("falls back to the bare date for an unnamed version", () => {
    expect(ruleVersionLabel(entry("2026-04-29"))).toBe("2026-04-29");
  });
});

describe("ruleVersionLabels", () => {
  it("keys each label by its version date", () => {
    const labels = ruleVersionLabels([
      entry("2026-03-30", "1.3", "Unleashed"),
      entry("2026-04-29"),
    ]);
    expect(labels.get("2026-03-30")).toBe("1.3 · Unleashed (2026-03-30)");
    expect(labels.get("2026-04-29")).toBe("2026-04-29");
  });
});

describe("rulesSettingsLabel", () => {
  it("pairs the document version with the upper-case language code", () => {
    expect(rulesSettingsLabel(entry("2026-10-09", "1.5"), "en", true)).toBe("1.5 EN");
  });

  it("drops the script subtag from the language code", () => {
    expect(rulesSettingsLabel(entry("2026-10-09", "1.5"), "zh-Hans", true)).toBe("1.5 ZH");
  });

  it("falls back to the version date when there is no document version", () => {
    expect(rulesSettingsLabel(entry("2026-04-29"), "fr", true)).toBe("2026-04-29 FR");
  });

  it("leaves the language out when it cannot be switched", () => {
    expect(rulesSettingsLabel(entry("2026-10-09", "1.5"), "en", false)).toBe("1.5");
  });
});

describe("rulesPhoneFacts", () => {
  it("names the document version, the spelled-out publish date and the language count", () => {
    expect(rulesPhoneFacts(entry("2026-10-09", "1.5"), 4)).toEqual([
      "Version 1.5",
      "Published Oct 9, 2026",
      "4 languages",
    ]);
  });

  it("leaves the version out when the document has none", () => {
    expect(rulesPhoneFacts(entry("2026-04-29"), 2)).toEqual([
      "Published Apr 29, 2026",
      "2 languages",
    ]);
  });

  it("counts a single language in the singular", () => {
    expect(rulesPhoneFacts(entry("2026-10-09", "1.5"), 1)).toContain("1 language");
  });
});
