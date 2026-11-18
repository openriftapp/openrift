import type { CardNameParts } from "@openrift/shared/card-name";
import { legendDisplayName } from "@openrift/shared/card-name";
import { tiedNamesText } from "@openrift/shared/card-search";
import { truncateWithEllipsis } from "@openrift/shared/strings";

// chars: Discord caps a message at 2000
const REPLY_LIMIT = 2000;

const QUERY_LIMIT = 100;

const NAME_LIMIT = 100;

const TAIL = " Pick one from the name suggestions.";

/** A user's query as quoted back in a reply: one line, short enough for any Discord message. */
export function quotableQuery(query: string): string {
  return truncateWithEllipsis(query.replaceAll(/\s+/gu, " ").trim(), QUERY_LIMIT);
}

export function cardTieReply(query: string, cards: readonly CardNameParts[]): string {
  const head = `“${quotableQuery(query)}” matches ${cards.length} cards: `;
  const names = cards.map((card) => truncateWithEllipsis(legendDisplayName(card), NAME_LIMIT));
  return `${head}${tiedNamesText(names, REPLY_LIMIT - head.length - TAIL.length)}${TAIL}`;
}
