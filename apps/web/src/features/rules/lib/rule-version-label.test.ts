import { describe, expect, it } from "vitest";

import { ruleVersionLabel, ruleVersionLabels } from "./rule-version-label";

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
