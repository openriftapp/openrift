import { matchesTextQuery } from "@openrift/shared/search-fold";

import type { QuickAddCardResult } from "@/features/collections/lib/quick-add-result";
import type { HelpArticle } from "@/lib/help-article";
import type { NavItemConfig } from "@/lib/nav-items";
import { m } from "@/paraglide/messages.js";

export type QuickAddVerb = "add" | "move";

const PALETTE_MIN_QUERY_LENGTH = 2;

const CARD_LIMIT = 6;
const NAV_LIMIT = 5;
const HELP_LIMIT = 3;

export type PaletteRow =
  | { kind: "quickAdd"; id: string; label: string; verb: QuickAddVerb }
  | { kind: "card"; id: string; card: QuickAddCardResult }
  | { kind: "nav"; id: string; item: NavItemConfig }
  | { kind: "help"; id: string; article: HelpArticle }
  | { kind: "searchCards"; id: string; query: string; matchCount?: number }
  | { kind: "searchRules"; id: string; query: string };

export interface PaletteGroup {
  heading: string;
  rows: PaletteRow[];
}

interface BuildPaletteGroupsInput {
  query: string;
  cards: QuickAddCardResult[];
  navItems: NavItemConfig[];
  helpArticles: HelpArticle[];
  quickAdd: { label: string; moveLabel: string | null } | null;
  syntaxMatchCount?: number;
}

/** Nav items are platform-gated, so the same destination can appear in both lists here; merge, keeping the richer description. */
function dedupeByDestination(navItems: NavItemConfig[]): NavItemConfig[] {
  const byDestination = new Map<string, NavItemConfig>();
  for (const item of navItems) {
    const seen = byDestination.get(item.to);
    if (!seen) {
      byDestination.set(item.to, item);
      continue;
    }
    if (seen.description === undefined && item.description !== undefined) {
      byDestination.set(item.to, { ...seen, description: item.description });
    }
  }
  return [...byDestination.values()];
}

/** Search rows sit at the bottom while cards matched, and move to the top when no card hit did. */
export function buildPaletteGroups({
  query,
  cards,
  navItems,
  helpArticles,
  quickAdd,
  syntaxMatchCount,
}: BuildPaletteGroupsInput): PaletteGroup[] {
  const trimmed = query.trim();
  const searchable = trimmed.length >= PALETTE_MIN_QUERY_LENGTH;

  const quickAddRows: PaletteRow[] = (
    quickAdd
      ? [
          { label: quickAdd.label, verb: "add" as const },
          ...(quickAdd.moveLabel === null
            ? []
            : [{ label: quickAdd.moveLabel, verb: "move" as const }]),
        ]
      : []
  )
    .filter((action) => trimmed === "" || matchesTextQuery(trimmed, [action.label]))
    .map((action) => ({ kind: "quickAdd", id: `quick-add:${action.verb}`, ...action }));

  const uniqueNav = dedupeByDestination(navItems);
  const navRows: PaletteRow[] = uniqueNav
    .filter((item) => trimmed === "" || matchesTextQuery(trimmed, [item.label, item.description]))
    .slice(0, trimmed === "" ? uniqueNav.length : NAV_LIMIT)
    .map((item) => ({ kind: "nav", id: `nav:${item.to}`, item }));

  if (trimmed === "") {
    return [
      ...(quickAddRows.length > 0
        ? [{ heading: m.palette_group_actions(), rows: quickAddRows }]
        : []),
      ...(navRows.length > 0 ? [{ heading: m.palette_group_go_to(), rows: navRows }] : []),
    ];
  }

  const cardRows: PaletteRow[] = cards
    .slice(0, CARD_LIMIT)
    .map((card) => ({ kind: "card", id: `card:${card.cardId}`, card }));

  const helpRows: PaletteRow[] = searchable
    ? helpArticles
        .filter((article) => matchesTextQuery(trimmed, [article.title, article.description]))
        .slice(0, HELP_LIMIT)
        .map((article) => ({ kind: "help", id: `help:${article.slug}`, article }))
    : [];

  let searchRows: PaletteRow[] = [];
  if (syntaxMatchCount !== undefined) {
    searchRows = [
      { kind: "searchCards", id: "search:cards", query: trimmed, matchCount: syntaxMatchCount },
    ];
  } else if (searchable) {
    searchRows = [
      { kind: "searchCards", id: "search:cards", query: trimmed },
      { kind: "searchRules", id: "search:rules", query: trimmed },
    ];
  }

  const groups: PaletteGroup[] = [];
  const pushSearch = () => {
    if (searchRows.length > 0) {
      groups.push({ heading: m.palette_group_search(), rows: searchRows });
    }
  };

  if (cardRows.length === 0) {
    pushSearch();
  }
  if (quickAddRows.length > 0) {
    groups.push({ heading: m.palette_group_actions(), rows: quickAddRows });
  }
  if (cardRows.length > 0) {
    groups.push({ heading: m.palette_group_cards(), rows: cardRows });
  }
  if (navRows.length > 0) {
    groups.push({ heading: m.palette_group_go_to(), rows: navRows });
  }
  if (helpRows.length > 0) {
    groups.push({ heading: m.palette_group_help(), rows: helpRows });
  }
  if (cardRows.length > 0) {
    pushSearch();
  }
  return groups;
}
