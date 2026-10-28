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
  };
}

interface Diagnostic {
  code: string;
  key?: string;
  value?: string;
}

function describe(diagnostic: Diagnostic): string {
  const key = diagnostic.key ? `${diagnostic.key}:` : "";
  switch (diagnostic.code) {
    case "unknownValue": {
      return `No ${diagnostic.key} called “${diagnostic.value}”`;
    }
    case "badValue": {
      return `“${diagnostic.value}” doesn't work with ${key}`;
    }
    case "badOperator": {
      return `${key} doesn't support that comparison`;
    }
    case "unsupportedKey": {
      return `${key} only works on the website`;
    }
    case "unbalancedParen": {
      return "Unmatched parenthesis";
    }
    case "tooComplex": {
      return "The query is too long";
    }
    default: {
      return `Problem with the query (${diagnostic.code})`;
    }
  }
}

export function searchErrorText(query: string, diagnostics: readonly Diagnostic[]): string {
  const problems = diagnostics.map((diagnostic) => `- ${describe(diagnostic)}`).join("\n");
  return `Couldn't run “${query}”:\n${problems}`;
}
