import { sql } from "kysely";

import { candidateSideOrder } from "../../../repositories/candidate-card-sql.js";

// The fragments read fixed aliases: `cc` candidate_cards, `c` cards, `mca`
// mv_card_aggregates, `cp` candidate_printings, `pr` printings, `p` the face, `s` sets.

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

export type CandidatePrintingComparison = ComparablePrintingValues & {
  imageUrl: string | null;
  imageFingerprint: string | null;
};

export type LivePrintingComparison = ComparablePrintingValues & {
  imageUrls: string[];
  imageFingerprints: (string | null)[];
};

export const candidateCardValues = sql<ComparableCardValues>`jsonb_build_object(
  'name', cc.name, 'types', cc.types, 'superTypes', cc.super_types,
  'domains', cc.domains, 'might', cc.might, 'energy', cc.energy,
  'power', cc.power, 'mightBonus', cc.might_bonus, 'tags', cc.tags
)`;

export const liveCardValues = sql<ComparableCardValues>`jsonb_build_object(
  'name', c.name, 'types', mca.types, 'superTypes', mca.super_types,
  'domains', mca.domains, 'might', c.might, 'energy', c.energy,
  'power', c.power, 'mightBonus', c.might_bonus, 'tags', c.tags
)`;

export const candidatePrintingValues = sql<CandidatePrintingComparison>`jsonb_build_object(
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
)`;

export const livePrintingValues = sql<LivePrintingComparison>`jsonb_build_object(
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
)`;

export const candidateSideOfPrinting = sql`join lateral (
  select f.* from faces f
  where f.id in (pr.face1_id, pr.face2_id)
  order by ${candidateSideOrder(
    {
      cardId: sql.ref("f.card_id"),
      shortCode: sql.ref("f.short_code"),
      isFirst: sql`f.id = pr.face1_id`,
    },
    { normName: sql.ref("cc.norm_name"), shortCode: sql.ref("cp.short_code") },
  )}
  limit 1
) p on true`;
