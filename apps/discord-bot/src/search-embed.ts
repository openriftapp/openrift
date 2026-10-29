import type { SearchResponse } from "@openrift/shared/contracts/search";
import { cardPath } from "@openrift/shared/site-paths";
import type { APIEmbed } from "discord.js";

import { EMBED_COLOR } from "./card-embed.js";

export const SEARCH_RESULT_LIMIT = 10;

export function searchPageUrl(siteUrl: string, query: string): string {
  return `${siteUrl}/cards?q=${encodeURIComponent(query)}`;
}

export function buildSearchEmbed({
  query,
  response,
  siteUrl,
}: {
  query: string;
  response: SearchResponse;
  siteUrl: string;
}): APIEmbed {
  const lines = response.printingIds.flatMap((printingId) => {
    const printing = response.printings[printingId];
    const card = printing ? response.cards[printing.cardId] : undefined;
    return card && printing
      ? [`[${card.name}](${siteUrl}${cardPath(card.slug)}) · ${printing.shortCode}`]
      : [];
  });
  const more = response.total - lines.length;
  const footer =
    more > 0
      ? `[${more} more on OpenRift](${searchPageUrl(siteUrl, query)})`
      : `[Open on OpenRift](${searchPageUrl(siteUrl, query)})`;
  return {
    color: EMBED_COLOR,
    title: `${response.total} ${response.total === 1 ? "result" : "results"} for ${query}`,
    url: searchPageUrl(siteUrl, query),
    description: response.total === 0 ? "Nothing matches." : [...lines, "", footer].join("\n"),
    ...(response.warnings.length > 0 ? { footer: { text: response.warnings.join("\n") } } : {}),
  };
}

export function emptySearchResponse(warnings: string[]): SearchResponse {
  return {
    total: 0,
    nextCursor: null,
    printingIds: [],
    printings: {},
    cards: {},
    sets: [],
    warnings,
  };
}

export function searchErrorText(query: string, warnings: readonly string[]): string {
  const problems = warnings.map((warning) => `- ${warning}`).join("\n");
  return `Couldn't run “${query}”:\n${problems}`;
}
