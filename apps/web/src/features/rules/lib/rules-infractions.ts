import type { RuleBlockKind, RulePenalty } from "@openrift/shared/rules-infractions";
import { parentRuleNumber, RULE_PENALTIES } from "@openrift/shared/rules-infractions";
import { matchesTextQuery } from "@openrift/shared/search-fold";
import type { RulePageEntry } from "@openrift/shared/types/api/rules";

import { ruleHtmlToText } from "@/features/rules/lib/rule-text";

export type InfractionBlock =
  | { kind: "line"; entry: RulePageEntry }
  | { kind: "group"; block: RuleBlockKind; heading: RulePageEntry; entries: RulePageEntry[] };

export interface InfractionItem {
  entry: RulePageEntry;
  penalties: RulePenalty[];
  stated: boolean;
  blocks: InfractionBlock[];
}

interface InfractionOverview {
  entry: RulePageEntry;
  entries: RulePageEntry[];
}

export interface InfractionSection {
  entry: RulePageEntry;
  overviews: InfractionOverview[];
  infractions: InfractionItem[];
}

function descendantsOf(rules: readonly RulePageEntry[], ruleNumber: string): RulePageEntry[] {
  return rules.filter((rule) => rule.ruleNumber.startsWith(`${ruleNumber}.`));
}

function infractionBlocks(descendants: readonly RulePageEntry[]): InfractionBlock[] {
  const blocks: InfractionBlock[] = [];
  let group: Extract<InfractionBlock, { kind: "group" }> | null = null;
  for (const entry of descendants) {
    if (group !== null && entry.ruleNumber.startsWith(`${group.heading.ruleNumber}.`)) {
      group.entries.push(entry);
      continue;
    }
    if (entry.block) {
      group = { kind: "group", block: entry.block, heading: entry, entries: [] };
      blocks.push(group);
      continue;
    }
    group = null;
    blocks.push({ kind: "line", entry });
  }
  return blocks;
}

/** Guide depth of `ruleNumber` below `ancestor`, where a direct child is 0. */
export function nestedRuleDepth(ruleNumber: string, ancestor: string): number {
  return Math.min(ruleNumber.split(".").length - ancestor.split(".").length - 1, 3);
}

export function buildInfractionSections(rules: readonly RulePageEntry[]): InfractionSection[] {
  const sectionNumbers = new Set(
    rules.flatMap((rule) => {
      const parent = rule.infraction ? parentRuleNumber(rule.ruleNumber) : undefined;
      return parent === undefined ? [] : [parent];
    }),
  );
  return rules
    .filter((rule) => sectionNumbers.has(rule.ruleNumber))
    .map((section) => {
      const children = rules.filter(
        (rule) => parentRuleNumber(rule.ruleNumber) === section.ruleNumber,
      );
      return {
        entry: section,
        overviews: children
          .filter((child) => child.infraction === undefined)
          .map((child) => ({ entry: child, entries: descendantsOf(rules, child.ruleNumber) })),
        infractions: children.flatMap((child) =>
          child.infraction === undefined
            ? []
            : [
                {
                  entry: child,
                  penalties: child.infraction.penalties,
                  stated: child.infraction.stated,
                  blocks: infractionBlocks(descendantsOf(rules, child.ruleNumber)),
                },
              ],
        ),
      };
    });
}

function infractionSearchFields(item: InfractionItem): string[] {
  return [
    item.entry.ruleNumber,
    ruleHtmlToText(item.entry.contentHtml),
    ...item.blocks.flatMap((block) =>
      block.kind === "line"
        ? [ruleHtmlToText(block.entry.contentHtml)]
        : [block.heading, ...block.entries].map((entry) => ruleHtmlToText(entry.contentHtml)),
    ),
  ];
}

export function filterInfractionSections(
  sections: readonly InfractionSection[],
  penalty: RulePenalty | null,
  query: string,
): InfractionSection[] {
  return sections.flatMap((section) => {
    const infractions = section.infractions.filter(
      (item) =>
        (penalty === null || item.penalties.includes(penalty)) &&
        matchesTextQuery(query, infractionSearchFields(item)),
    );
    return infractions.length === 0 ? [] : [{ ...section, infractions }];
  });
}

const PENALTY_BADGE_REGEX = /\s*<span data-penalty="[^"]*">[^<]*<\/span>/gu;

export function withoutPenaltyBadges(html: string): string {
  return html.replaceAll(PENALTY_BADGE_REGEX, "");
}

const HEADLINE_NAME_REGEX = /^[\s*]*(?<name>[^:：]+)/u;

export function ruleHeadlineName(html: string): string {
  const text = ruleHtmlToText(withoutPenaltyBadges(html));
  return HEADLINE_NAME_REGEX.exec(text)?.groups?.name?.trim() ?? text;
}

const HASH_HREF_REGEX = /href="#(?<id>[^"]+)"/gu;

export function withLinksTo(html: string, onPage: ReadonlySet<string>, elsewhere: string): string {
  return html.replaceAll(HASH_HREF_REGEX, (match, id: string) =>
    onPage.has(id) ? match : `href="${elsewhere}#${id}"`,
  );
}

export function infractionPenaltyCounts(
  sections: readonly InfractionSection[],
): { penalty: RulePenalty; count: number }[] {
  const items = sections.flatMap((section) => section.infractions);
  return RULE_PENALTIES.map((penalty) => ({
    penalty,
    count: items.filter((item) => item.penalties.includes(penalty)).length,
  })).filter((entry) => entry.count > 0);
}
