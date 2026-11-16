/**
 * Finds the infractions of a tournament rules document. Detection reads only the
 * English text; translations share rule numbers, so the marks apply to every language.
 */

export const RULE_PENALTIES = [
  "No Penalty",
  "Warning",
  "Game Loss",
  "Match Loss",
  "Disqualification",
] as const;

export type RulePenalty = (typeof RULE_PENALTIES)[number];

export const RULE_BLOCK_KINDS = ["remedies", "examples"] as const;

export type RuleBlockKind = (typeof RULE_BLOCK_KINDS)[number];

interface InfractionMark {
  penalties: RulePenalty[];
  stated: boolean;
}

export interface RuleInfractionMarks {
  infractions: ReadonlyMap<string, InfractionMark>;
  blocks: ReadonlyMap<string, RuleBlockKind>;
}

interface OutlineRow {
  ruleNumber: string;
  content: string;
}

const PENALTY_PATTERN = String.raw`\[\s*[*_]*\s*(?<penalty>No Penalty|Warnings?|Game Loss|Match Loss|Disqualification)\s*[*_]*\s*\]`;
const HEADLINE_REGEX = /^\*(?<name>(?:[^*[]|\[[^\]]*\])+?)(?::\*|\*\s*:|(?<=\])\s*:)/u;
const BLOCK_REGEXES: readonly [RuleBlockKind, RegExp][] = [
  ["remedies", /^[*_\s]*(?:Other\s+)?Remedies\b/u],
  ["examples", /^[*_\s]*Examples\b/u],
];

function penaltiesIn(text: string): RulePenalty[] {
  const found = new Set<RulePenalty>();
  for (const match of text.matchAll(new RegExp(PENALTY_PATTERN, "gu"))) {
    const label = match.groups?.penalty;
    found.add(label === "Warnings" ? "Warning" : (label as RulePenalty));
  }
  return [...found];
}

function bySeverity(penalties: Iterable<RulePenalty>): RulePenalty[] {
  const present = new Set(penalties);
  return RULE_PENALTIES.filter((penalty) => present.has(penalty));
}

export function parentRuleNumber(ruleNumber: string): string | undefined {
  const index = ruleNumber.lastIndexOf(".");
  return index === -1 ? undefined : ruleNumber.slice(0, index);
}

function isDescendant(ruleNumber: string, ancestor: string): boolean {
  return ruleNumber.startsWith(`${ancestor}.`);
}

export function hasInfractions(rules: readonly { infraction?: unknown }[]): boolean {
  return rules.some((rule) => rule.infraction !== undefined);
}

/**
 * An infraction is a rule with an italic `*Name:*` headline among siblings where at least one
 * headline names a penalty. Remedies and examples headings count only inside infractions.
 */
export function findRuleInfractions(englishRows: readonly OutlineRow[]): RuleInfractionMarks {
  const headlines = new Map<string, string>();
  for (const row of englishRows) {
    const name = HEADLINE_REGEX.exec(row.content)?.groups?.name;
    if (name !== undefined) {
      headlines.set(row.ruleNumber, name);
    }
  }

  const sections = new Set<string>();
  for (const [ruleNumber, name] of headlines) {
    const parent = parentRuleNumber(ruleNumber);
    if (parent !== undefined && penaltiesIn(name).length > 0) {
      sections.add(parent);
    }
  }

  const infractions = new Map<string, InfractionMark>();
  const blocks = new Map<string, RuleBlockKind>();
  for (const [ruleNumber, name] of headlines) {
    const parent = parentRuleNumber(ruleNumber);
    if (parent === undefined || !sections.has(parent)) {
      continue;
    }
    const stated = penaltiesIn(name);
    const descendants = englishRows.filter((row) => isDescendant(row.ruleNumber, ruleNumber));
    for (const row of descendants) {
      const block = BLOCK_REGEXES.find(([, regex]) => regex.test(row.content))?.[0];
      if (block !== undefined) {
        blocks.set(row.ruleNumber, block);
      }
    }
    infractions.set(ruleNumber, {
      penalties:
        stated.length > 0
          ? bySeverity(stated)
          : bySeverity(descendants.flatMap((row) => penaltiesIn(row.content))),
      stated: stated.length > 0,
    });
  }
  return { infractions, blocks };
}
