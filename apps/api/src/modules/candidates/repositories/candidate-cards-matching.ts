import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";

export interface ComparableCardValues {
  name: string;
  types: string[];
  superTypes: string[];
  domains: string[];
  might: number | null;
  energy: number | null;
  power: number | null;
  mightBonus: number | null;
  tags: string[];
}

export interface UncheckedCandidateCardWithLive {
  id: string;
  candidate: ComparableCardValues;
  live: ComparableCardValues | null;
}

export interface ComparablePrintingValues {
  shortCode: string;
  setId: string | null;
  rarity: string | null;
  artVariant: string | null;
  isSigned: boolean | null;
  isOvernumbered: boolean | null;
  markerSlugs: string[];
  distributionChannelSlugs: string[];
  finish: string | null;
  size: string | null;
  artist: string | null;
  publicCode: string | null;
  printedRulesText: string | null;
  printedEffectText: string | null;
  flavorText: string | null;
  language: string | null;
  printedName: string | null;
  printedYear: number | null;
}

export interface UncheckedCandidatePrintingWithLive {
  id: string;
  candidate: ComparablePrintingValues & { imageUrl: string | null };
  live: ComparablePrintingValues & { imageUrls: string[] };
}

export function candidateMatchingRepo(db: Kysely<Database>) {
  return {
    /** Live values come from the card sharing the candidate's normalized name, or an alias of it. */
    async listUncheckedCandidateCardsWithLive(
      excludeProvider: string,
    ): Promise<UncheckedCandidateCardWithLive[]> {
      const rows = await sql<UncheckedCandidateCardWithLive>`
        select
          cc.id,
          jsonb_build_object(
            'name', cc.name, 'types', cc.types, 'superTypes', cc.super_types,
            'domains', cc.domains, 'might', cc.might, 'energy', cc.energy,
            'power', cc.power, 'mightBonus', cc.might_bonus, 'tags', cc.tags
          ) as candidate,
          (
            select jsonb_build_object(
              'name', c.name, 'types', mca.types, 'superTypes', mca.super_types,
              'domains', mca.domains, 'might', c.might, 'energy', c.energy,
              'power', c.power, 'mightBonus', c.might_bonus, 'tags', c.tags
            )
            from cards c
            join mv_card_aggregates mca on mca.card_id = c.id
            where c.norm_name = cc.norm_name
              or c.id in (select a.card_id from card_name_aliases a where a.norm_name = cc.norm_name)
            order by c.norm_name = cc.norm_name desc
            limit 1
          ) as live
        from candidate_cards cc
        where cc.checked_at is null
          and cc.provider <> ${excludeProvider}
      `.execute(db);
      return rows.rows;
    },

    /** Only linked candidate printings compare; an unlinked one is a new printing. */
    async listUncheckedCandidatePrintingsWithLive(
      excludeProvider: string,
    ): Promise<UncheckedCandidatePrintingWithLive[]> {
      const rows = await sql<UncheckedCandidatePrintingWithLive>`
        select
          cp.id,
          jsonb_build_object(
            'shortCode', cp.short_code, 'setId', cp.set_id, 'rarity', cp.rarity,
            'artVariant', cp.art_variant, 'isSigned', cp.is_signed,
            'isOvernumbered', cp.is_overnumbered, 'markerSlugs', cp.marker_slugs,
            'distributionChannelSlugs', cp.distribution_channel_slugs,
            'finish', cp.finish, 'size', cp.size, 'artist', cp.artist,
            'publicCode', cp.public_code, 'printedRulesText', cp.printed_rules_text,
            'printedEffectText', cp.printed_effect_text, 'flavorText', cp.flavor_text,
            'language', cp.language, 'printedName', cp.printed_name,
            'printedYear', cp.printed_year, 'imageUrl', cp.image_url
          ) as candidate,
          jsonb_build_object(
            'shortCode', p.short_code, 'setId', s.slug, 'rarity', p.rarity,
            'artVariant', p.art_variant, 'isSigned', p.is_signed,
            'isOvernumbered', p.is_overnumbered, 'markerSlugs', p.marker_slugs,
            'distributionChannelSlugs', coalesce((
              select array_agg(dc.slug)
              from printing_distribution_channels pdc
              join distribution_channels dc on dc.id = pdc.channel_id
              where pdc.printing_id = p.id
            ), '{}'::text[]),
            'finish', p.finish, 'size', p.size, 'artist', p.artist,
            'publicCode', p.public_code, 'printedRulesText', p.printed_rules_text,
            'printedEffectText', p.printed_effect_text, 'flavorText', p.flavor_text,
            'language', p.language, 'printedName', p.printed_name,
            'printedYear', p.printed_year,
            'imageUrls', coalesce((
              select array_remove(array_agg(u), null)
              from printing_images pi
              join image_files imgf on imgf.id = pi.image_file_id
              cross join lateral unnest(array[imgf.original_url, imgf.rehosted_url]) as u
              where pi.printing_id = p.id and pi.face = 'front' and pi.is_active
            ), '{}'::text[])
          ) as live
        from candidate_printings cp
        join candidate_cards cc on cc.id = cp.candidate_card_id
        join printings p on p.id = cp.printing_id
        join sets s on s.id = p.set_id
        where cp.checked_at is null
          and cc.provider <> ${excludeProvider}
      `.execute(db);
      return rows.rows;
    },

    async checkCandidateCardsByIds(ids: readonly string[], now: Date): Promise<number> {
      if (ids.length === 0) {
        return 0;
      }
      const result = await db
        .updateTable("candidateCards")
        .set({ checkedAt: now })
        .where("id", "in", [...ids])
        .where("checkedAt", "is", null)
        .executeTakeFirstOrThrow();
      return Number(result.numUpdatedRows);
    },

    async checkCandidatePrintingsByIds(ids: readonly string[], now: Date): Promise<number> {
      if (ids.length === 0) {
        return 0;
      }
      const result = await db
        .updateTable("candidatePrintings")
        .set({ checkedAt: now })
        .where("id", "in", [...ids])
        .where("checkedAt", "is", null)
        .executeTakeFirstOrThrow();
      return Number(result.numUpdatedRows);
    },
  };
}
