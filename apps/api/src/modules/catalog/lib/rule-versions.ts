import type {
  RuleChangeType,
  RuleKind,
  RuleLanguage,
  RuleType,
} from "@openrift/shared/types/api/rules";

import type { Repos } from "../../../deps.js";

type RulesRepo = Repos["rules"];

export interface ParsedRule {
  ruleNumber: string;
  ruleType: RuleType;
  content: string;
  depth: number;
  sortOrder: number;
}

interface VersionKey {
  kind: RuleKind;
  language: RuleLanguage;
  version: string;
}

export interface VersionDetails {
  comments?: string | null;
  label?: string | null;
  documentVersion?: string | null;
}

export interface SaveResult {
  status: "created" | "updated" | "unchanged";
  rulesCount: number;
  added: number;
  modified: number;
  removed: number;
}

/** Depth of a rule number from its dot-separated segments: 0 for "100", 1 for "100.1", 2 for "100.1.a", 3 for "100.1.a.1". */
function computeDepth(ruleNumber: string): number {
  const parts = ruleNumber.split(".");
  return Math.min(parts.length - 1, 3);
}

const RULE_LINE_REGEX = /^(?<number>\d+(?:\.[A-Za-z0-9]+)*)\.\s+(?<rest>.*)$/u;

/**
 * Parses the markdown rule format into rule rows. Each non-blank line is
 * `<rule_number>. <markdown_content>`, where a leading `# ` marks a title and
 * `## ` a subtitle. Literal `\n` sequences in the content become real newlines
 * so a single line can hold a multi-paragraph rule.
 */
export function parseRulesText(text: string): ParsedRule[] {
  const rules: ParsedRule[] = [];
  const lines = text.split("\n");
  let sortOrder = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("===")) {
      continue;
    }

    const match = RULE_LINE_REGEX.exec(line);
    if (!match) {
      continue;
    }

    const ruleNumber = match[1];
    // Tolerate a leading "| " column-separator from sources that mirror the
    // legacy pipe-delimited format.
    const rest = match[2]?.replace(/^\|\s*/u, "");
    if (!ruleNumber || !rest) {
      continue;
    }

    let ruleType: ParsedRule["ruleType"] = "text";
    let content = rest;
    if (rest.startsWith("## ")) {
      ruleType = "subtitle";
      content = rest.slice(3);
    } else if (rest.startsWith("# ")) {
      ruleType = "title";
      content = rest.slice(2);
    }

    content = content.replaceAll(String.raw`\n`, "\n").trim();
    if (!content) {
      continue;
    }

    rules.push({
      ruleNumber,
      ruleType,
      content,
      depth: computeDepth(ruleNumber),
      sortOrder,
    });
    sortOrder++;
  }

  return rules;
}

export function duplicateRuleNumbers(rules: readonly ParsedRule[]): string[] {
  const counts = Map.groupBy(rules, (rule) => rule.ruleNumber);
  return [...counts].filter(([, group]) => group.length > 1).map(([ruleNumber]) => ruleNumber);
}

export function sameRules(a: readonly ParsedRule[], b: readonly ParsedRule[]): boolean {
  const byOrder = (rules: readonly ParsedRule[]) =>
    rules.toSorted((x, y) => x.sortOrder - y.sortOrder);
  const left = byOrder(a);
  const right = byOrder(b);
  return (
    left.length === right.length &&
    left.every((rule, index) => {
      const other = right[index];
      return (
        other !== undefined &&
        rule.ruleNumber === other.ruleNumber &&
        rule.ruleType === other.ruleType &&
        rule.content === other.content &&
        rule.depth === other.depth &&
        rule.sortOrder === other.sortOrder
      );
    })
  );
}

/** The language's previous version, or on a translation's first version the English types of its date. */
export type ChangeBase =
  | { previous: ReadonlyMap<string, string> }
  | { english: ReadonlyMap<string, RuleChangeType> }
  | null;

export function computeChangeTypes(
  rules: readonly { ruleNumber: string; content: string }[],
  base: ChangeBase,
): Map<string, RuleChangeType> {
  return new Map(
    rules.map((rule): [string, RuleChangeType] => {
      if (base === null) {
        return [rule.ruleNumber, "added"];
      }
      if ("english" in base) {
        const english = base.english.get(rule.ruleNumber);
        return [
          rule.ruleNumber,
          english === "added" || english === "modified" ? english : "unchanged",
        ];
      }
      const previous = base.previous.get(rule.ruleNumber);
      if (previous === undefined) {
        return [rule.ruleNumber, "added"];
      }
      return [rule.ruleNumber, previous === rule.content ? "unchanged" : "modified"];
    }),
  );
}

async function changeBase(repo: RulesRepo, key: VersionKey): Promise<ChangeBase> {
  const previous = await repo.previousVersion(key.kind, key.language, key.version);
  if (previous !== undefined) {
    const rows = await repo.listSnapshot(key.kind, key.language, previous);
    return { previous: new Map(rows.map((row) => [row.ruleNumber, row.content])) };
  }
  if (key.language === "en") {
    return null;
  }
  const rows = await repo.listSnapshot(key.kind, "en", key.version);
  return { english: new Map(rows.map((row) => [row.ruleNumber, row.changeType])) };
}

async function retypeVersion(repo: RulesRepo, key: VersionKey): Promise<void> {
  const rows = await repo.listSnapshot(key.kind, key.language, key.version);
  const types = computeChangeTypes(rows, await changeBase(repo, key));
  const stale = Map.groupBy(
    rows.flatMap((row) => {
      const changeType = types.get(row.ruleNumber);
      return changeType === undefined || changeType === row.changeType
        ? []
        : [{ ruleNumber: row.ruleNumber, changeType }];
    }),
    (row) => row.changeType,
  );
  for (const [changeType, group] of stale) {
    await repo.setChangeType(
      key.kind,
      key.language,
      key.version,
      changeType,
      group.map((row) => row.ruleNumber),
    );
  }
}

/** Recomputes the language's change types; English also re-types each translation's first version. */
export async function retypeLanguage(
  repo: RulesRepo,
  kind: RuleKind,
  language: RuleLanguage,
): Promise<void> {
  const versions = await repo.listAllVersions(kind);
  const ownVersions = versions.filter((entry) => entry.language === language);
  for (const entry of ownVersions) {
    await retypeVersion(repo, { kind, language, version: entry.version });
  }
  if (language !== "en") {
    return;
  }
  const translations = Map.groupBy(
    versions.filter((entry) => entry.language !== "en"),
    (entry) => entry.language,
  );
  for (const [translation, [first]] of translations) {
    if (first !== undefined) {
      await retypeVersion(repo, { kind, language: translation, version: first.version });
    }
  }
}

async function summarize(
  repo: RulesRepo,
  key: VersionKey,
  status: SaveResult["status"],
): Promise<SaveResult> {
  const rows = await repo.listSnapshot(key.kind, key.language, key.version);
  const previous = await repo.previousVersion(key.kind, key.language, key.version);
  const numbers = new Set(rows.map((row) => row.ruleNumber));
  const previousRows =
    previous === undefined ? [] : await repo.listSnapshot(key.kind, key.language, previous);
  const removed = previousRows.filter((row) => !numbers.has(row.ruleNumber)).length;
  return {
    status,
    rulesCount: rows.length,
    added: rows.filter((row) => row.changeType === "added").length,
    modified: rows.filter((row) => row.changeType === "modified").length,
    removed,
  };
}

/**
 * Creates or replaces a version. Identical rules leave the rows untouched;
 * details left `undefined` keep their stored value.
 */
export async function saveRulesVersion(
  repo: RulesRepo,
  key: VersionKey,
  rules: readonly ParsedRule[],
  details: VersionDetails,
): Promise<SaveResult> {
  const existing = await repo.getVersion(key.kind, key.language, key.version);
  if (existing) {
    const stored = await repo.listSnapshot(key.kind, key.language, key.version);
    if (sameRules(rules, stored)) {
      const merged = {
        comments: details.comments === undefined ? existing.comments : details.comments,
        label: details.label === undefined ? existing.label : details.label,
        documentVersion:
          details.documentVersion === undefined
            ? existing.documentVersion
            : details.documentVersion,
      };
      const detailsChanged =
        merged.comments !== existing.comments ||
        merged.label !== existing.label ||
        merged.documentVersion !== existing.documentVersion;
      if (detailsChanged) {
        await repo.updateDetails(key.kind, key.language, key.version, merged);
      }
      return summarize(repo, key, detailsChanged ? "updated" : "unchanged");
    }
  }

  await repo.upsertVersion(key, details);
  await repo.deleteRules(key.kind, key.language, key.version);
  await repo.insertRules(rules.map((rule) => ({ ...key, ...rule, changeType: "unchanged" })));
  await retypeLanguage(repo, key.kind, key.language);
  return summarize(repo, key, existing ? "updated" : "created");
}
