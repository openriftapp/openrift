import type { MetaDeckDetailResponse } from "@openrift/shared/types/api/meta";

import { archivedDeckIdentity } from "@/features/meta/lib/meta-deck-identity";
import { formatRank, formatRecord } from "@/features/meta/lib/meta-format";
import { getSiteUrl } from "@/lib/site-config";
import { m } from "@/paraglide/messages.js";

export interface MetaDeckCopyFields {
  name: string;
  description: string;
}

const MAX_DECK_NAME_LENGTH = 200;

function escapeLinkText(text: string): string {
  return text.replaceAll(/[[\]\\]/gu, String.raw`\$&`);
}

/** Written into the copy once, so links are absolute: the deck description only renders allowlisted https hosts. */
export function metaDeckCopyFields(
  data: Pick<MetaDeckDetailResponse, "deck" | "cards" | "meta">,
  token: string,
): MetaDeckCopyFields {
  const { meta } = data;
  const legend = archivedDeckIdentity(data.cards)?.name ?? null;
  let name = data.deck.name;
  if (legend !== null) {
    name = meta.playerName === "" ? legend : `${legend} (${meta.playerName})`;
  }

  const siteUrl = getSiteUrl();
  const event = `[${escapeLinkText(meta.event.name)}](${siteUrl}/meta/${meta.event.slug})`;
  const date = meta.event.eventDate;
  const played =
    meta.playerName === ""
      ? m.meta_deck_copy_played_anonymous({ event, date })
      : m.meta_deck_copy_played({ player: meta.playerName, event, date });
  const rank = formatRank(meta.rank, meta.rankIsTier);
  const record = formatRecord(meta.wins, meta.losses, meta.draws);
  const finish =
    record === null
      ? m.meta_deck_copy_finish({ rank })
      : m.meta_deck_copy_finish_record({ rank, record });
  const source = `[${m.meta_deck_copy_source_link()}](${siteUrl}/meta/decks/${token})`;

  return {
    name: name.slice(0, MAX_DECK_NAME_LENGTH),
    description: `${played} ${finish}\n\n${source}`,
  };
}
