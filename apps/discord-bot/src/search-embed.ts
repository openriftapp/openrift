import { legendDisplayName } from "@openrift/shared/card-name";
import type { SearchResponse } from "@openrift/shared/contracts/search";
import { DISCORD_EMBED_COLOR } from "@openrift/shared/discord-embed";
import { cardUrl } from "@openrift/shared/site-paths";
import { pluralize, truncateWithEllipsis } from "@openrift/shared/strings";
import type { APIEmbed } from "discord.js";

import { quotableQuery } from "./card-tie-reply.js";

export const SEARCH_RESULT_LIMIT = 10;
const TITLE_LIMIT = 256;
const DESCRIPTION_LIMIT = 4096;
const FOOTER_LIMIT = 2048;
const MESSAGE_LIMIT = 2000;

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
      ? [`[${legendDisplayName(card)}](${cardUrl(siteUrl, card.slug)}) · ${printing.shortCode}`]
      : [];
  });
  const more = response.total - lines.length;
  const label = more > 0 ? `${more} more on OpenRift` : "Open on OpenRift";
  const linked = [...lines, "", `[${label}](${searchPageUrl(siteUrl, query)})`].join("\n");
  const description =
    linked.length <= DESCRIPTION_LIMIT ? linked : [...lines, "", label].join("\n");
  const head = `${response.total} ${pluralize(response.total, "result", "results")} for `;
  return {
    color: DISCORD_EMBED_COLOR,
    title: `${head}${truncateWithEllipsis(query, TITLE_LIMIT - head.length)}`,
    url: searchPageUrl(siteUrl, query),
    description: response.total === 0 ? "Nothing matches." : description,
    ...(response.warnings.length > 0
      ? { footer: { text: truncateWithEllipsis(response.warnings.join("\n"), FOOTER_LIMIT) } }
      : {}),
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
  return truncateWithEllipsis(
    `Couldn't run “${quotableQuery(query)}”:\n${problems}`,
    MESSAGE_LIMIT,
  );
}
