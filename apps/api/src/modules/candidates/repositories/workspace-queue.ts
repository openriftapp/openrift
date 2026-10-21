import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import { notHiddenSource, notIgnoredCard, notIgnoredPrinting } from "./candidate-cards-shared.js";

interface ComparableCardValues {
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
  releasedAt: string | null;
  releasePrecision: string | null;
  announcedAt: string | null;
}

export interface WorkspaceCardDifferenceRow {
  id: string;
  provider: string;
  createdAt: Date;
  cardSlug: string;
  cardName: string;
  candidate: ComparableCardValues;
  live: ComparableCardValues;
}

export interface WorkspaceDraftRow {
  id: string;
  provider: string;
  normName: string;
  name: string;
  createdAt: Date;
}

export interface WorkspaceLinkedPrintingRow {
  id: string;
  candidateCardId: string;
  provider: string;
  createdAt: Date;
  printedTotal: number | null;
  printingId: string;
  faceId: string;
  side: 1 | 2;
  cardSlug: string;
  cardName: string;
  printingLabel: string;
  faceShortCode: string;
  candidate: ComparablePrintingValues & {
    imageUrl: string | null;
    imageFingerprint: string | null;
  };
  live: ComparablePrintingValues & { imageUrls: string[]; imageFingerprints: (string | null)[] };
}

export interface WorkspaceNewPrintingRow {
  id: string;
  candidateCardId: string;
  provider: string;
  createdAt: Date;
  cardSlug: string;
  cardName: string;
  shortCode: string;
  finish: string | null;
  language: string | null;
}

export interface WorkspaceInactiveImageRow {
  imageId: string;
  faceId: string;
  createdAt: Date;
  cardSlug: string;
  cardName: string;
  shortCode: string;
  printingIds: string[];
  isBack: boolean;
}

const reviewableProvider = sql<boolean>`(
  cc.provider <> ${USER_SUBMISSION_PROVIDER}
  or exists (
    select 1 from card_submissions cs
    where cs.candidate_card_id = cc.id and cs.status = 'pending'
  )
)`;

const cardForCandidate = sql`
  select c.id, c.slug, c.name from cards c
  where c.norm_name = cc.norm_name
    or c.id in (select a.card_id from card_name_aliases a where a.norm_name = cc.norm_name)
  order by c.norm_name = cc.norm_name desc
  limit 1
`;

export function workspaceQueueRepo(db: Kysely<Database>) {
  return {
    async uncheckedCardDifferences(): Promise<WorkspaceCardDifferenceRow[]> {
      const rows = await sql<WorkspaceCardDifferenceRow>`
        select
          cc.id,
          cc.provider,
          cc.created_at as "createdAt",
          live_card.slug as "cardSlug",
          live_card.name as "cardName",
          jsonb_build_object(
            'name', cc.name, 'types', cc.types, 'superTypes', cc.super_types,
            'domains', cc.domains, 'might', cc.might, 'energy', cc.energy,
            'power', cc.power, 'mightBonus', cc.might_bonus, 'tags', cc.tags
          ) as candidate,
          jsonb_build_object(
            'name', c.name, 'types', mca.types, 'superTypes', mca.super_types,
            'domains', mca.domains, 'might', c.might, 'energy', c.energy,
            'power', c.power, 'mightBonus', c.might_bonus, 'tags', c.tags
          ) as live
        from candidate_cards cc
        join lateral (${cardForCandidate}) live_card on true
        join cards c on c.id = live_card.id
        join mv_card_aggregates mca on mca.card_id = c.id
        where cc.checked_at is null
          and cc.provider <> ${USER_SUBMISSION_PROVIDER}
          and ${notIgnoredCard("cc")}
          and ${notHiddenSource("cc")}
      `.execute(db);
      return rows.rows;
    },

    async newCardDrafts(): Promise<WorkspaceDraftRow[]> {
      const rows = await sql<WorkspaceDraftRow>`
        select cc.id, cc.provider, cc.norm_name as "normName", cc.name, cc.created_at as "createdAt"
        from candidate_cards cc
        where not exists (select 1 from cards c where c.norm_name = cc.norm_name)
          and not exists (select 1 from card_name_aliases a where a.norm_name = cc.norm_name)
          and ${reviewableProvider}
          and ${notIgnoredCard("cc")}
          and ${notHiddenSource("cc")}
      `.execute(db);
      return rows.rows;
    },

    async uncheckedLinkedPrintings(): Promise<WorkspaceLinkedPrintingRow[]> {
      const rows = await sql<WorkspaceLinkedPrintingRow>`
        select
          cp.id,
          cp.candidate_card_id as "candidateCardId",
          cc.provider,
          cp.created_at as "createdAt",
          s.printed_total as "printedTotal",
          pr.id as "printingId",
          p.id as "faceId",
          case when p.id = pr.face1_id then 1 else 2 end as side,
          fc.slug as "cardSlug",
          fc.name as "cardName",
          concat_ws(' ', f1.short_code, f1.finish, f1.language) as "printingLabel",
          p.short_code as "faceShortCode",
          jsonb_build_object(
            'shortCode', cp.short_code, 'setId', cp.set_id, 'rarity', cp.rarity,
            'artVariant', cp.art_variant, 'isSigned', cp.is_signed,
            'isOvernumbered', cp.is_overnumbered, 'markerSlugs', cp.marker_slugs,
            'distributionChannelSlugs', cp.distribution_channel_slugs,
            'finish', cp.finish, 'size', cp.size, 'artist', cp.artist,
            'publicCode', cp.public_code, 'printedRulesText', cp.printed_rules_text,
            'printedEffectText', cp.printed_effect_text, 'flavorText', cp.flavor_text,
            'language', cp.language, 'printedName', cp.printed_name,
            'printedYear', cp.printed_year, 'releasedAt', cp.released_at,
            'releasePrecision', cp.release_precision, 'announcedAt', cp.announced_at,
            'imageUrl', cp.image_url,
            'imageFingerprint', cp.image_fingerprint
          ) as candidate,
          jsonb_build_object(
            'shortCode', p.short_code, 'setId', s.slug, 'rarity', p.rarity,
            'artVariant', p.art_variant, 'isSigned', p.is_signed,
            'isOvernumbered', p.is_overnumbered, 'markerSlugs', p.marker_slugs,
            'distributionChannelSlugs', coalesce((
              select array_agg(dc.slug)
              from printing_distribution_channels pdc
              join distribution_channels dc on dc.id = pdc.channel_id
              where pdc.printing_id = pr.id
            ), '{}'::text[]),
            'finish', p.finish, 'size', pr.size, 'artist', p.artist,
            'publicCode', p.public_code, 'printedRulesText', p.printed_rules_text,
            'printedEffectText', p.printed_effect_text, 'flavorText', p.flavor_text,
            'language', p.language, 'printedName', p.printed_name,
            'printedYear', p.printed_year, 'releasedAt', pr.released_at,
            'releasePrecision', pr.release_precision, 'announcedAt', pr.announced_at,
            'imageUrls', coalesce((
              select array_remove(array_agg(u), null)
              from face_images pi
              join image_files imgf on imgf.id = pi.image_file_id
              cross join lateral unnest(array[imgf.original_url, imgf.rehosted_url]) as u
              where pi.face_id = p.id and pi.is_active
            ), '{}'::text[]),
            'imageFingerprints', coalesce((
              select array_agg(imgf.fingerprint)
              from face_images pi
              join image_files imgf on imgf.id = pi.image_file_id
              where pi.face_id = p.id and pi.is_active
            ), '{}'::text[])
          ) as live
        from candidate_printings cp
        join candidate_cards cc on cc.id = cp.candidate_card_id
        join printings pr on pr.id = cp.printing_id
        join faces f1 on f1.id = pr.face1_id
        join lateral (
          select f.* from faces f
          where f.id in (pr.face1_id, pr.face2_id)
          order by
            exists (
              select 1 from card_name_aliases a
              where a.card_id = f.card_id and a.norm_name = cc.norm_name
            ) desc,
            upper(f.short_code) = upper(cp.short_code) desc,
            f.id = pr.face1_id desc
          limit 1
        ) p on true
        join cards fc on fc.id = p.card_id
        join sets s on s.id = p.set_id
        where cp.checked_at is null
          and ${reviewableProvider}
          and ${notIgnoredCard("cc")}
          and ${notIgnoredPrinting("cp", "cc")}
          and ${notHiddenSource("cc")}
      `.execute(db);
      return rows.rows;
    },

    async newCandidatePrintings(): Promise<WorkspaceNewPrintingRow[]> {
      const rows = await sql<WorkspaceNewPrintingRow>`
        select
          cp.id,
          cp.candidate_card_id as "candidateCardId",
          cc.provider,
          cp.created_at as "createdAt",
          live_card.slug as "cardSlug",
          live_card.name as "cardName",
          cp.short_code as "shortCode",
          cp.finish,
          cp.language
        from candidate_printings cp
        join candidate_cards cc on cc.id = cp.candidate_card_id
        join lateral (${cardForCandidate}) live_card on true
        where cp.printing_id is null
          and ${reviewableProvider}
          and ${notIgnoredCard("cc")}
          and ${notIgnoredPrinting("cp", "cc")}
          and ${notHiddenSource("cc")}
      `.execute(db);
      return rows.rows;
    },

    async inactiveFaceImages(): Promise<WorkspaceInactiveImageRow[]> {
      const rows = await sql<WorkspaceInactiveImageRow>`
        select
          fi.id as "imageId",
          f.id as "faceId",
          fi.created_at as "createdAt",
          c.slug as "cardSlug",
          c.name as "cardName",
          f.short_code as "shortCode",
          array_agg(pr.id order by pr.id) as "printingIds",
          coalesce(bool_and(pr.face2_id = f.id), false) as "isBack"
        from face_images fi
        join faces f on f.id = fi.face_id
        join cards c on c.id = f.card_id
        join printings pr on f.id in (pr.face1_id, pr.face2_id)
        where not fi.is_active
        group by fi.id, f.id, c.slug, c.name
      `.execute(db);
      return rows.rows;
    },

    async countAdminEventsSince(actorUserId: string, since: Date): Promise<number> {
      const row = await db
        .selectFrom("adminEvents")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("actorUserId", "=", actorUserId)
        .where(sql<Date>`date_trunc('milliseconds', ${sql.ref("createdAt")})`, ">=", since)
        .executeTakeFirstOrThrow();
      return Number(row.count);
    },
  };
}
