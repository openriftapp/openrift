import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import { notIgnoredCard, notIgnoredPrinting } from "./candidate-cards-shared.js";

export interface CatalogSourceRow {
  provider: string;
  rows: number;
  printingRows: number;
  isHidden: boolean;
  isFavorite: boolean;
  helperReviewable: boolean;
  sortOrder: number;
  lastUploadedAt: Date | null;
  ignoredCount: number;
  uncheckedRows: number;
}

export function candidateCatalogListRepo(db: Kysely<Database>) {
  return {
    /** `lastUploadedAt` counts ignored rows too: an ignored candidate still
     *  arrived in that upload. */
    async listCatalogSourceRows(): Promise<CatalogSourceRow[]> {
      const result = await sql<CatalogSourceRow>`
        with providers as (
          select provider from provider_settings
          union
          select provider from candidate_cards
        ),
        card_stats as (
          select provider, count(*) filter (where live)::int as card_rows
          from (
            select cc.provider, ${notIgnoredCard("cc")} as live
            from candidate_cards cc
          ) rows_with_state
          group by provider
        ),
        upload_stats as (
          select provider, max(touched_at) as last_uploaded_at
          from (
            select cc.provider, greatest(cc.updated_at, cc.created_at) as touched_at
            from candidate_cards cc
            union all
            select cc.provider, greatest(cp.updated_at, cp.created_at)
            from candidate_printings cp
            join candidate_cards cc on cc.id = cp.candidate_card_id
          ) writes
          group by provider
        ),
        printing_stats as (
          select cc.provider, count(*)::int as printing_rows
          from candidate_printings cp
          join candidate_cards cc on cc.id = cp.candidate_card_id
          where ${notIgnoredCard("cc")}
            and ${notIgnoredPrinting("cp", "cc")}
          group by cc.provider
        ),
        ignored_stats as (
          select provider, count(*)::int as ignored
          from (
            select provider from ignored_candidate_cards
            union all
            select provider from ignored_candidate_printings
          ) i
          group by provider
        ),
        -- Ignored and hidden rows count: "mark all checked" settles them too.
        unchecked_stats as (
          select provider, count(*)::int as unchecked
          from (
            select cc.provider
            from candidate_cards cc
            where cc.checked_at is null
            union all
            select cc.provider
            from candidate_printings cp
            join candidate_cards cc on cc.id = cp.candidate_card_id
            where cp.checked_at is null
          ) u
          group by provider
        )
        select
          p.provider as "provider",
          coalesce(cs.card_rows, 0) as "rows",
          coalesce(pst.printing_rows, 0) as "printingRows",
          coalesce(s.is_hidden, false) as "isHidden",
          coalesce(s.is_favorite, false) as "isFavorite",
          coalesce(s.helper_reviewable, false) as "helperReviewable",
          coalesce(s.sort_order, 0) as "sortOrder",
          us.last_uploaded_at as "lastUploadedAt",
          coalesce(i.ignored, 0) as "ignoredCount",
          coalesce(u.unchecked, 0) as "uncheckedRows"
        from providers p
        left join provider_settings s on s.provider = p.provider
        left join card_stats cs on cs.provider = p.provider
        left join upload_stats us on us.provider = p.provider
        left join printing_stats pst on pst.provider = p.provider
        left join ignored_stats i on i.provider = p.provider
        left join unchecked_stats u on u.provider = p.provider
        order by coalesce(s.sort_order, 0), p.provider
      `.execute(db);
      return result.rows;
    },
  };
}
