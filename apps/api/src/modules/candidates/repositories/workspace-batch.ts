import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import { isNewCardName, liveCardForNorm } from "../../../repositories/candidate-card-sql.js";
import {
  acceptableCandidatePrinting,
  notHiddenSource,
  notIgnoredCard,
} from "./candidate-cards-shared.js";

export interface TrustedDraftRow {
  id: string;
  provider: string;
  normName: string;
  name: string;
  types: string[];
}

export interface TrustedNewPrintingRow {
  id: string;
  candidateCardId: string;
  provider: string;
  cardId: string;
  cardSlug: string;
}

export interface PrintingProbeRow {
  printingId: string;
  cardId: string;
  shortCode: string;
  language: string;
  size: string;
  distributionChannelSlugs: string[];
}

export function workspaceBatchRepo(db: Kysely<Database>) {
  return {
    async trustedNewCardDrafts(providers: readonly string[]): Promise<TrustedDraftRow[]> {
      if (providers.length === 0) {
        return [];
      }
      const rows = await sql<TrustedDraftRow>`
        select cc.id, cc.provider, cc.norm_name as "normName", cc.name, cc.types
        from candidate_cards cc
        where cc.provider in (${sql.join(providers)})
          and ${isNewCardName(sql.ref("cc.norm_name"))}
          and ${notIgnoredCard("cc")}
          and ${notHiddenSource("cc")}
        order by cc.norm_name, cc.provider
      `.execute(db);
      return rows.rows;
    },

    async trustedNewPrintings(providers: readonly string[]): Promise<TrustedNewPrintingRow[]> {
      if (providers.length === 0) {
        return [];
      }
      const rows = await sql<TrustedNewPrintingRow>`
        select
          cp.id,
          cp.candidate_card_id as "candidateCardId",
          cc.provider,
          live_card.id as "cardId",
          live_card.slug as "cardSlug"
        from candidate_printings cp
        join candidate_cards cc on cc.id = cp.candidate_card_id
        join lateral (${liveCardForNorm(sql.ref("cc.norm_name"))}) live_card on true
        where cc.provider in (${sql.join(providers)})
          and ${acceptableCandidatePrinting("cp", "cc")}
        order by live_card.slug, cp.short_code, cp.id
      `.execute(db);
      return rows.rows;
    },

    async frontPrintingProbes(cardIds: readonly string[]): Promise<PrintingProbeRow[]> {
      if (cardIds.length === 0) {
        return [];
      }
      const rows = await sql<PrintingProbeRow>`
        select
          pr.id as "printingId",
          f.card_id as "cardId",
          f.short_code as "shortCode",
          f.language,
          pr.size,
          coalesce((
            select array_agg(dc.slug order by dc.slug)
            from printing_distribution_channels pdc
            join distribution_channels dc on dc.id = pdc.channel_id
            where pdc.printing_id = pr.id
          ), '{}'::text[]) as "distributionChannelSlugs"
        from printings pr
        join faces f on f.id = pr.face1_id
        where f.card_id in (${sql.join(cardIds)})
      `.execute(db);
      return rows.rows;
    },
  };
}
