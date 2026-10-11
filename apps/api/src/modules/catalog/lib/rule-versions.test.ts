import type { RuleChangeType, RuleKind, RuleLanguage } from "@openrift/shared/types/api/rules";
import { describe, expect, it } from "vitest";

import type { Repos } from "../../../deps.js";
import type { ParsedRule } from "./rule-versions.js";
import {
  computeChangeTypes,
  duplicateRuleNumbers,
  parseRulesText,
  retypeLanguage,
  sameRules,
  saveRulesVersion,
} from "./rule-versions.js";

describe("parseRulesText", () => {
  it("recognises titles, subtitles, and plain text by markdown prefix", () => {
    const input = [
      "000. # Golden and Silver Rules",
      "001. ## Golden Rule",
      "002. Card text supersedes rules text.",
    ].join("\n");

    expect(parseRulesText(input)).toEqual([
      {
        ruleNumber: "000",
        ruleType: "title",
        content: "Golden and Silver Rules",
        depth: 0,
        sortOrder: 0,
      },
      { ruleNumber: "001", ruleType: "subtitle", content: "Golden Rule", depth: 0, sortOrder: 1 },
      {
        ruleNumber: "002",
        ruleType: "text",
        content: "Card text supersedes rules text.",
        depth: 0,
        sortOrder: 2,
      },
    ]);
  });

  it("derives depth from the dot-separated rule number, capped at 3", () => {
    const input = [
      "100. Top",
      "100.1. Second",
      "100.1.a. Third",
      "100.1.a.1. Fourth",
      "100.1.a.1.x. Fifth (clamped)",
    ].join("\n");

    expect(parseRulesText(input).map((rule) => [rule.ruleNumber, rule.depth])).toEqual([
      ["100", 0],
      ["100.1", 1],
      ["100.1.a", 2],
      ["100.1.a.1", 3],
      ["100.1.a.1.x", 3],
    ]);
  });

  it("expands the literal two-character backslash-n sequence into real newlines", () => {
    const input = String.raw`103.2. *A Main Deck of at least 40 cards*\n  1 Chosen Champion Unit\n  Units`;

    const rules = parseRulesText(input);

    expect(rules).toHaveLength(1);
    expect(rules[0]!.content).toBe(
      "*A Main Deck of at least 40 cards*\n  1 Chosen Champion Unit\n  Units",
    );
  });

  it("skips blank lines, separator lines, and unparseable lines", () => {
    const input = [
      "",
      "=== version 1.0 ===",
      "not a rule line",
      "001. ## Golden Rule",
      "",
      "002. Card text supersedes rules text.",
    ].join("\n");

    expect(parseRulesText(input).map((rule) => rule.ruleNumber)).toEqual(["001", "002"]);
  });

  it("preserves markdown markers (italics, etc.) in the stored content", () => {
    const input = '052. *Card*, when written in card effects, is shorthand for "Main Deck card."';

    expect(parseRulesText(input)[0]!.content).toBe(
      '*Card*, when written in card effects, is shorthand for "Main Deck card."',
    );
  });

  it("strips a leading pipe separator before detecting the markdown prefix", () => {
    const input = [
      "000. | # Golden and Silver Rules",
      "001. | ## Golden Rule",
      "002. | Card text supersedes rules text.",
    ].join("\n");

    expect(parseRulesText(input).map((rule) => [rule.ruleType, rule.content])).toEqual([
      ["title", "Golden and Silver Rules"],
      ["subtitle", "Golden Rule"],
      ["text", "Card text supersedes rules text."],
    ]);
  });
});

describe("duplicateRuleNumbers", () => {
  it("lists each rule number used more than once", () => {
    const rules = parseRulesText(
      ["001. A.", "002. B.", "001. C.", "002. D.", "003. E."].join("\n"),
    );
    expect(duplicateRuleNumbers(rules)).toEqual(["001", "002"]);
  });

  it("is empty when every number is unique", () => {
    expect(duplicateRuleNumbers(parseRulesText("001. A.\n002. B."))).toEqual([]);
  });
});

describe("sameRules", () => {
  const rules = parseRulesText("001. # Title\n002. A rule.");

  it("matches identical rules in any array order", () => {
    expect(sameRules(rules, rules.toReversed())).toBe(true);
  });

  it("differs on content, type, order or count", () => {
    expect(sameRules(rules, parseRulesText("001. # Title\n002. Another rule."))).toBe(false);
    expect(sameRules(rules, parseRulesText("001. ## Title\n002. A rule."))).toBe(false);
    expect(sameRules(rules, parseRulesText("002. A rule.\n001. # Title"))).toBe(false);
    expect(sameRules(rules, parseRulesText("001. # Title"))).toBe(false);
  });
});

describe("computeChangeTypes", () => {
  const rules = [
    { ruleNumber: "001", content: "Same." },
    { ruleNumber: "002", content: "New text." },
    { ruleNumber: "003", content: "Brand new." },
  ];

  it("marks every rule added when there is nothing to compare with", () => {
    expect([...computeChangeTypes(rules, null).values()]).toEqual(["added", "added", "added"]);
  });

  it("compares content with the previous version", () => {
    const previous = new Map([
      ["001", "Same."],
      ["002", "Old text."],
    ]);
    expect(Object.fromEntries(computeChangeTypes(rules, { previous }))).toEqual({
      "001": "unchanged",
      "002": "modified",
      "003": "added",
    });
  });

  it("copies added and modified from the English types, everything else is unchanged", () => {
    const english = new Map<string, RuleChangeType>([
      ["001", "modified"],
      ["002", "unchanged"],
    ]);
    expect(Object.fromEntries(computeChangeTypes(rules, { english }))).toEqual({
      "001": "modified",
      "002": "unchanged",
      "003": "unchanged",
    });
  });
});

interface StoredVersion {
  kind: RuleKind;
  language: RuleLanguage;
  version: string;
  comments: string | null;
  label: string | null;
  documentVersion: string | null;
  importedAt: Date;
}

interface StoredRule extends ParsedRule {
  kind: RuleKind;
  language: RuleLanguage;
  version: string;
  changeType: RuleChangeType;
}

function createRulesStore() {
  const versions: StoredVersion[] = [];
  let rules: StoredRule[] = [];
  const writes: string[] = [];
  const sameKey = (kind: RuleKind, language: RuleLanguage, version: string) => (row: StoredRule) =>
    row.kind === kind && row.language === language && row.version === version;
  const findVersion = (kind: RuleKind, language: RuleLanguage, version: string) =>
    versions.find((v) => v.kind === kind && v.language === language && v.version === version);

  const repo = {
    getVersion: async (kind: RuleKind, language: RuleLanguage, version: string) =>
      findVersion(kind, language, version),
    listSnapshot: async (kind: RuleKind, language: RuleLanguage, version: string) =>
      rules
        .filter((row) => sameKey(kind, language, version)(row))
        .toSorted((a, b) => a.sortOrder - b.sortOrder)
        .map((row) => ({ ...row })),
    previousVersion: async (kind: RuleKind, language: RuleLanguage, version: string) =>
      versions
        .filter((v) => v.kind === kind && v.language === language && v.version < version)
        .map((v) => v.version)
        .toSorted()
        .at(-1),
    listAllVersions: async (kind?: RuleKind) =>
      versions
        .filter((v) => kind === undefined || v.kind === kind)
        .toSorted(
          (a, b) => a.version.localeCompare(b.version) || a.language.localeCompare(b.language),
        ),
    upsertVersion: async (
      key: { kind: RuleKind; language: RuleLanguage; version: string },
      details: { comments?: string | null; label?: string | null; documentVersion?: string | null },
    ) => {
      writes.push(`upsert ${key.language} ${key.version}`);
      const existing = findVersion(key.kind, key.language, key.version);
      const defined = Object.fromEntries(
        Object.entries(details).filter(([, value]) => value !== undefined),
      );
      if (existing) {
        Object.assign(existing, defined);
        return existing;
      }
      const created = {
        comments: null,
        label: null,
        documentVersion: null,
        ...key,
        ...defined,
        importedAt: new Date(),
      };
      versions.push(created);
      return created;
    },
    updateDetails: async (
      kind: RuleKind,
      language: RuleLanguage,
      version: string,
      details: { comments: string | null; label: string | null; documentVersion: string | null },
    ) => {
      writes.push(`details ${language} ${version}`);
      const existing = findVersion(kind, language, version);
      if (existing) {
        Object.assign(existing, details);
      }
      return existing;
    },
    deleteRules: async (kind: RuleKind, language: RuleLanguage, version: string) => {
      writes.push(`delete ${language} ${version}`);
      rules = rules.filter((row) => !sameKey(kind, language, version)(row));
      return [];
    },
    insertRules: async (rows: StoredRule[]) => {
      rules.push(...rows.map((row) => ({ ...row })));
      return rows.length;
    },
    setChangeType: async (
      kind: RuleKind,
      language: RuleLanguage,
      version: string,
      changeType: RuleChangeType,
      ruleNumbers: readonly string[],
    ) => {
      writes.push(`retype ${language} ${version}`);
      for (const row of rules) {
        if (sameKey(kind, language, version)(row) && ruleNumbers.includes(row.ruleNumber)) {
          row.changeType = changeType;
        }
      }
    },
    deleteVersion: async (kind: RuleKind, language: RuleLanguage, version: string) => {
      const index = versions.findIndex(
        (v) => v.kind === kind && v.language === language && v.version === version,
      );
      versions.splice(index, 1);
      rules = rules.filter((row) => !sameKey(kind, language, version)(row));
      return [];
    },
  };

  const types = (language: RuleLanguage, version: string) =>
    Object.fromEntries(
      rules
        .filter((row) => sameKey("core", language, version)(row))
        .map((row) => [row.ruleNumber, row.changeType]),
    );

  return { repo: repo as unknown as Repos["rules"], raw: repo, types, writes };
}

const save = (
  store: ReturnType<typeof createRulesStore>,
  language: RuleLanguage,
  version: string,
  lines: string[],
  details: {
    comments?: string | null;
    label?: string | null;
    documentVersion?: string | null;
  } = {},
) =>
  saveRulesVersion(
    store.repo,
    { kind: "core", language, version },
    parseRulesText(lines.join("\n")),
    details,
  );

describe("saveRulesVersion", () => {
  it("creates a first version with every rule added", async () => {
    const store = createRulesStore();

    const result = await save(store, "en", "2026-01-01", ["001. A.", "002. B."], {
      label: "Origins",
    });

    expect(result).toEqual({ status: "created", rulesCount: 2, added: 2, modified: 0, removed: 0 });
    expect(store.types("en", "2026-01-01")).toEqual({ "001": "added", "002": "added" });
    expect(await store.raw.getVersion("core", "en", "2026-01-01")).toMatchObject({
      label: "Origins",
    });
  });

  it("stores every rule of a later version and counts the changes against the previous one", async () => {
    const store = createRulesStore();
    await save(store, "en", "2026-01-01", ["001. A.", "002. B.", "003. C."]);

    const result = await save(store, "en", "2026-02-01", ["001. A.", "002. B2.", "004. D."]);

    expect(result).toEqual({ status: "created", rulesCount: 3, added: 1, modified: 1, removed: 1 });
    expect(store.types("en", "2026-02-01")).toEqual({
      "001": "unchanged",
      "002": "modified",
      "004": "added",
    });
  });

  it("leaves an identical version untouched", async () => {
    const store = createRulesStore();
    await save(store, "en", "2026-01-01", ["001. A.", "002. B."]);
    store.writes.length = 0;

    const result = await save(store, "en", "2026-01-01", ["001. A.", "002. B."]);

    expect(result).toEqual({
      status: "unchanged",
      rulesCount: 2,
      added: 2,
      modified: 0,
      removed: 0,
    });
    expect(store.writes).toEqual([]);
  });

  it("only updates the details when the rules are identical but a detail differs", async () => {
    const store = createRulesStore();
    await save(store, "en", "2026-01-01", ["001. A."], { label: "Origins", comments: "Note" });
    store.writes.length = 0;

    const result = await save(store, "en", "2026-01-01", ["001. A."], { label: "Spiritforged" });

    expect(result.status).toBe("updated");
    expect(store.writes).toEqual(["details en 2026-01-01"]);
    expect(await store.raw.getVersion("core", "en", "2026-01-01")).toMatchObject({
      label: "Spiritforged",
      comments: "Note",
    });
  });

  it("keeps stored details that are left out when replacing the rules", async () => {
    const store = createRulesStore();
    await save(store, "en", "2026-01-01", ["001. A."], { label: "Origins", comments: "Note" });

    const result = await save(store, "en", "2026-01-01", ["001. A2."], { comments: null });

    expect(result.status).toBe("updated");
    expect(await store.raw.getVersion("core", "en", "2026-01-01")).toMatchObject({
      label: "Origins",
      comments: null,
    });
  });

  it("re-types the next version when a middle version is replaced", async () => {
    const store = createRulesStore();
    await save(store, "en", "2026-01-01", ["001. A."]);
    await save(store, "en", "2026-02-01", ["001. A.", "002. B."]);
    await save(store, "en", "2026-03-01", ["001. A.", "002. B."]);

    await save(store, "en", "2026-02-01", ["001. A2.", "002. B2."]);

    expect(store.types("en", "2026-02-01")).toEqual({ "001": "modified", "002": "added" });
    expect(store.types("en", "2026-03-01")).toEqual({ "001": "modified", "002": "modified" });
  });

  it("re-types the following version when an earlier one is inserted", async () => {
    const store = createRulesStore();
    await save(store, "en", "2026-03-01", ["001. A.", "002. B."]);

    await save(store, "en", "2026-01-01", ["001. A."]);

    expect(store.types("en", "2026-03-01")).toEqual({ "001": "unchanged", "002": "added" });
  });

  it("gives a translation's first version the English types of its date", async () => {
    const store = createRulesStore();
    await save(store, "en", "2026-01-01", ["001. A.", "002. B."]);
    await save(store, "en", "2026-02-01", ["001. A2.", "002. B.", "003. C."]);

    await save(store, "fr", "2026-02-01", ["001. Un.", "002. Deux.", "003. Trois."]);

    expect(store.types("fr", "2026-02-01")).toEqual({
      "001": "modified",
      "002": "unchanged",
      "003": "added",
    });
  });

  it("re-types a translation's first version when its English version is replaced", async () => {
    const store = createRulesStore();
    await save(store, "en", "2026-01-01", ["001. A.", "002. B."]);
    await save(store, "en", "2026-02-01", ["001. A.", "002. B."]);
    await save(store, "fr", "2026-02-01", ["001. Un.", "002. Deux."]);

    await save(store, "en", "2026-02-01", ["001. A.", "002. B2."]);

    expect(store.types("fr", "2026-02-01")).toEqual({ "001": "unchanged", "002": "modified" });
  });

  it("re-types a translation's first version when the English version before it is replaced", async () => {
    const store = createRulesStore();
    await save(store, "en", "2026-01-01", ["001. A.", "002. B."]);
    await save(store, "en", "2026-02-01", ["001. A.", "002. B."]);
    await save(store, "fr", "2026-02-01", ["001. Un.", "002. Deux."]);

    await save(store, "en", "2026-01-01", ["001. A0.", "002. B."]);

    expect(store.types("en", "2026-02-01")).toEqual({ "001": "modified", "002": "unchanged" });
    expect(store.types("fr", "2026-02-01")).toEqual({ "001": "modified", "002": "unchanged" });
  });

  it("diffs a later translated version against the previous one in the same language", async () => {
    const store = createRulesStore();
    await save(store, "en", "2026-01-01", ["001. A."]);
    await save(store, "en", "2026-02-01", ["001. A.", "002. B."]);
    await save(store, "fr", "2026-01-01", ["001. Un."]);

    const result = await save(store, "fr", "2026-02-01", ["001. Un!", "002. Deux."]);

    expect(result).toMatchObject({ added: 1, modified: 1, removed: 0 });
    expect(store.types("fr", "2026-02-01")).toEqual({ "001": "modified", "002": "added" });
  });
});

describe("retypeLanguage", () => {
  it("re-types the version after a deleted one against the version before it", async () => {
    const store = createRulesStore();
    await save(store, "en", "2026-01-01", ["001. A."]);
    await save(store, "en", "2026-02-01", ["001. A2."]);
    await save(store, "en", "2026-03-01", ["001. A2."]);

    await store.raw.deleteVersion("core", "en", "2026-02-01");
    await retypeLanguage(store.repo, "core", "en");

    expect(store.types("en", "2026-03-01")).toEqual({ "001": "modified" });
  });

  it("writes nothing when every type is already right", async () => {
    const store = createRulesStore();
    await save(store, "en", "2026-01-01", ["001. A."]);
    await save(store, "en", "2026-02-01", ["001. A2."]);
    store.writes.length = 0;

    await retypeLanguage(store.repo, "core", "en");

    expect(store.writes).toEqual([]);
  });
});
