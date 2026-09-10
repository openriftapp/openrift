import { WellKnown } from "@openrift/shared/well-known";
import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import { notHiddenSource, notIgnoredCard, notIgnoredPrinting } from "./candidate-cards-shared.js";

export interface CatalogCardListRow {
  cardSlug: string | null;
  name: string;
  normName: string;
  firstSetSlug: string | null;
  firstSetName: string | null;
  setSlugs: string[];
  shortCodes: string[];
  printingCount: number;
  printingsWithoutImage: number;
  proposals: number;
  newPrintings: number;
  uncheckedTrustedProviders: string[];
  updatedAt: Date;
}

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
}

const EN = WellKnown.language.EN;

/** A punctuation-only name normalizes to `''`, which as a key would merge every
 *  such candidate into one row. `#` cannot occur in a norm name. */
function groupKey(alias: string) {
  return sql<string>`case when ${sql.ref(`${alias}.normName`)} = ''
    then '#' || ${sql.ref(`${alias}.name`)}
    else ${sql.ref(`${alias}.normName`)} end`;
}

export function candidateCatalogListRepo(db: Kysely<Database>) {
  return {
    async listCatalogCardRows(scope: string[] | null): Promise<CatalogCardListRow[]> {
      const result = await sql<CatalogCardListRow>`
        with cand as (
          select
            cc.id,
            cc.norm_name,
            ${groupKey("cc")} as group_key,
            cc.provider,
            cc.name,
            cc.checked_at,
            cc.created_at,
            cc.updated_at
          from candidate_cards cc
          where ${notIgnoredCard("cc")}
            and ${notHiddenSource("cc")}
            and (${scope}::text[] is null or cc.provider = any(${scope}::text[]))
        ),
        trusted_cand as (
          select
            c.group_key,
            c.provider,
            (
              select count(*) from candidate_printings cp
              where cp.candidate_card_id = c.id
                and cp.printing_id is null
                and ${notIgnoredPrinting("cp", "c")}
            )::int as new_printings,
            (
              c.checked_at is null or exists (
                select 1 from candidate_printings cp
                where cp.candidate_card_id = c.id
                  and cp.checked_at is null
                  and ${notIgnoredPrinting("cp", "c")}
              )
            ) as unchecked
          from cand c
          where exists (
            select 1 from provider_settings ps
            where ps.provider = c.provider and ps.is_favorite and not ps.is_hidden
          )
        ),
        card_keys as (
          select distinct on (norm_name) card_id, norm_name
          from (
            select id as card_id, norm_name, 0 as priority from cards
            union all
            select card_id, norm_name, 1 as priority from card_name_aliases
          ) k
          order by norm_name, priority, card_id
        ),
        printing_rows as (
          select
            po.card_id, po.id, po.set_id, po.language, po.short_code, po.canonical_rank,
            not exists (
              select 1 from printing_images pi
              where pi.printing_id = po.id and pi.face = 'front' and pi.is_active
            ) as missing_image
          from printings_ordered po
        ),
        card_printings as (
          select
            p.card_id,
            count(*)::int as printing_count,
            count(*) filter (where p.missing_image)::int as printings_without_image,
            array_agg(distinct s.slug) as set_slugs,
            array_agg(
              case when p.language = ${EN} then p.short_code
                   else p.short_code || ' [' || p.language || ']' end
              order by p.canonical_rank, p.short_code, p.id
            ) as short_codes,
            (array_agg(s.slug order by s.sort_order, p.canonical_rank, p.short_code, p.id))[1]
              as first_set_slug,
            (array_agg(s.name order by s.sort_order, p.canonical_rank, p.short_code, p.id))[1]
              as first_set_name
          from printing_rows p
          join sets s on s.id = p.set_id
          group by p.card_id
        ),
        card_updated as (
          select k.card_id, max(c.updated_at) as updated_at
          from cand c
          join card_keys k on k.norm_name = c.group_key
          group by k.card_id
        ),
        card_cand as (
          select
            k.card_id,
            coalesce(sum(t.new_printings), 0)::int as new_printings,
            coalesce(
              array_agg(distinct t.provider) filter (where t.unchecked),
              '{}'::text[]
            ) as unchecked_trusted
          from trusted_cand t
          join card_keys k on k.norm_name = t.group_key
          group by k.card_id
        ),
        props as (
          select ${groupKey("cc")} as group_key, count(*)::int as proposals
          from card_submissions cs
          join candidate_cards cc on cc.id = cs.candidate_card_id
          where cs.status = 'pending'
            and ${notIgnoredCard("cc")}
            and ${notHiddenSource("cc")}
            and (${scope}::text[] is null or cc.provider = any(${scope}::text[]))
          group by 1
        ),
        card_props as (
          select k.card_id, coalesce(sum(p.proposals), 0)::int as proposals
          from props p
          join card_keys k on k.norm_name = p.group_key
          group by k.card_id
        ),
        drafts as (
          select
            c.group_key,
            (array_agg(c.name order by c.created_at, c.id))[1] as name,
            (array_agg(c.norm_name order by c.created_at, c.id))[1] as norm_name,
            max(c.updated_at) as updated_at
          from cand c
          where not exists (select 1 from card_keys k where k.norm_name = c.group_key)
          group by c.group_key
        ),
        draft_cand as (
          select
            t.group_key,
            coalesce(sum(t.new_printings), 0)::int as new_printings,
            coalesce(
              array_agg(distinct t.provider) filter (where t.unchecked),
              '{}'::text[]
            ) as unchecked_trusted
          from trusted_cand t
          where exists (select 1 from drafts d where d.group_key = t.group_key)
          group by t.group_key
        ),
        draft_printings as (
          select
            c.group_key,
            coalesce(
              array_agg(distinct cp.set_id) filter (where cp.set_id is not null),
              '{}'::text[]
            ) as set_slugs,
            array_agg(
              case when cp.language is null or cp.language = ${EN} then cp.short_code
                   else cp.short_code || ' [' || cp.language || ']' end
              order by cp.short_code, cp.language, cp.id
            ) as short_codes
          from cand c
          join candidate_printings cp on cp.candidate_card_id = c.id
          where ${notIgnoredPrinting("cp", "c")}
            and exists (select 1 from drafts d where d.group_key = c.group_key)
          group by c.group_key
        )
        select * from (
        select
          c.slug as "cardSlug",
          c.name as "name",
          c.norm_name as "normName",
          cpr.first_set_slug as "firstSetSlug",
          cpr.first_set_name as "firstSetName",
          coalesce(cpr.set_slugs, '{}'::text[]) as "setSlugs",
          coalesce(cpr.short_codes, '{}'::text[]) as "shortCodes",
          coalesce(cpr.printing_count, 0) as "printingCount",
          coalesce(cpr.printings_without_image, 0) as "printingsWithoutImage",
          coalesce(cpp.proposals, 0) as "proposals",
          coalesce(ccd.new_printings, 0) as "newPrintings",
          coalesce(ccd.unchecked_trusted, '{}'::text[]) as "uncheckedTrustedProviders",
          greatest(c.updated_at, cup.updated_at) as "updatedAt"
        from cards c
        left join card_printings cpr on cpr.card_id = c.id
        left join card_updated cup on cup.card_id = c.id
        left join card_cand ccd on ccd.card_id = c.id
        left join card_props cpp on cpp.card_id = c.id
        union all
        select
          null as "cardSlug",
          d.name as "name",
          d.norm_name as "normName",
          null as "firstSetSlug",
          null as "firstSetName",
          coalesce(dp.set_slugs, '{}'::text[]) as "setSlugs",
          coalesce(dp.short_codes, '{}'::text[]) as "shortCodes",
          0 as "printingCount",
          0 as "printingsWithoutImage",
          coalesce(p.proposals, 0) as "proposals",
          coalesce(dc.new_printings, 0) as "newPrintings",
          coalesce(dc.unchecked_trusted, '{}'::text[]) as "uncheckedTrustedProviders",
          d.updated_at as "updatedAt"
        from drafts d
        left join draft_cand dc on dc.group_key = d.group_key
        left join draft_printings dp on dp.group_key = d.group_key
        left join props p on p.group_key = d.group_key
        ) catalog_rows
        order by ("cardSlug" is null), "name", "normName"
      `.execute(db);
      return result.rows;
    },

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
          coalesce(i.ignored, 0) as "ignoredCount"
        from providers p
        left join provider_settings s on s.provider = p.provider
        left join card_stats cs on cs.provider = p.provider
        left join upload_stats us on us.provider = p.provider
        left join printing_stats pst on pst.provider = p.provider
        left join ignored_stats i on i.provider = p.provider
        order by coalesce(s.sort_order, 0), p.provider
      `.execute(db);
      return result.rows;
    },
  };
}
