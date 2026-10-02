import { describe, expect, it } from "vitest";

import {
  ruleKindDescription,
  ruleKindTitle,
  ruleVersionDescription,
  VALID_RULE_KINDS,
} from "./rules-kinds";

describe("rules-kinds", () => {
  it("titles each rule kind", () => {
    expect(ruleKindTitle("tournament")).toBe("Tournament Rules");
    expect(ruleKindTitle("core")).toBe("Core Rules");
  });

  it("titles and describes a rules document in its own language", () => {
    expect(ruleKindTitle("core", "fr")).toBe("Règles de base");
    expect(ruleVersionDescription("tournament", "1.4", "ko")).toBe(
      "Riftbound 대회 규정, 버전 1.4.",
    );
    expect(ruleVersionDescription("core", "1.4", "en")).toBe(
      "Riftbound core game rules, version 1.4.",
    );
  });

  it("describes each rule kind", () => {
    expect(ruleKindDescription("tournament")).toBe(
      "Read the official Riftbound tournament rules and event policy.",
    );
  });

  it("recognizes the valid rule kinds", () => {
    expect(VALID_RULE_KINDS.has("core")).toBe(true);
    expect(VALID_RULE_KINDS.has("tournament")).toBe(true);
  });
});
