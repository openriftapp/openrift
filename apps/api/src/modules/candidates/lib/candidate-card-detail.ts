import { mostCommonValue } from "@openrift/shared/collections";
import { ERROR_CODES } from "@openrift/shared/error-codes";
import { formatPrintingLabel } from "@openrift/shared/printing-label";
import { slugifyName } from "@openrift/shared/strings";
import type {
  AdminMarketplaceName,
  AdminPrintingMarketplaceMappingResponse,
  CandidatePrintingGroupResponse,
} from "@openrift/shared/types/api/admin";
import { marketplaceEnum } from "@openrift/shared/types/pricing";
import { WellKnown } from "@openrift/shared/well-known";

import { AppError } from "../../../errors.js";
import { classifyAgainstLive } from "../../../lib/image-fingerprint.js";
import type { marketplaceMappingRepo } from "../../marketplace/repositories/marketplace-mapping.js";
import type { candidateCardsRepo } from "../repositories/candidate-cards.js";
import { formatCandidateCard, formatCandidatePrinting } from "./candidate-presenters.js";

type Repo = ReturnType<typeof candidateCardsRepo>;
type MarketplaceMappingRepo = ReturnType<typeof marketplaceMappingRepo>;

/** Near-miss printing suggestion weights — see `findSuggestedPrinting`. A stated
 *  marker is the strongest signal, so a printing missing one outranks a finish
 *  mismatch: sources mis-report finish constantly (a foil-only promo listed as
 *  normal) but rarely invent a marker. An extra marker beyond what the source
 *  declared is the cheapest miss, because sources under-report them. */
const MISSING_MARKER_COST = 1000;
const FINISH_MISMATCH_COST = 100;
const EXTRA_MARKER_COST = 1;

function toMarketplaceName(marketplace: string): AdminMarketplaceName | null {
  const parsed = marketplaceEnum.safeParse(marketplace);
  return parsed.success ? parsed.data : null;
}

function deriveExpectedCardId(displayName: string, currentSlug?: string): string {
  if (displayName) {
    return slugifyName(displayName);
  }
  return currentSlug ?? "";
}

function resolveFinish(finish: string | null, rarity: string | null): string {
  if (finish) {
    return finish;
  }
  if (!rarity) {
    return "";
  }
  return rarity === WellKnown.rarity.COMMON || rarity === WellKnown.rarity.UNCOMMON
    ? WellKnown.finish.NORMAL
    : WellKnown.finish.FOIL;
}

type CardForDetail = Awaited<ReturnType<Repo["cardForDetailBySlug"]>>;

async function buildDetailResponse(
  repo: Repo,
  marketplaceRepo: MarketplaceMappingRepo | null,
  card: NonNullable<CardForDetail> | null,
  errata: Awaited<ReturnType<Repo["cardErrataForDetail"]>>,
  normNames: string[],
  fallbackDisplayName: string,
  allowedProviders: Set<string> | null = null,
) {
  const allCandidates = normNames.length > 0 ? await repo.candidateCardsForDetail(normNames) : [];
  // card-review grant holders only see candidates from allowed providers
  // (null = full admin, unscoped). Candidate printings, groups, and source
  // images all derive from the filtered ids. Accepted printings/images stay
  // unfiltered — that's live catalog data, not candidate data.
  const candidates =
    allowedProviders === null
      ? allCandidates
      : allCandidates.filter((s) => allowedProviders.has(s.provider));
  const candidateIds = candidates.map((s) => s.id);
  const candidatePrintings =
    candidateIds.length > 0 ? await repo.candidatePrintingsForDetail(candidateIds) : [];

  const printings = card ? await repo.printingsForDetail(card.id) : [];

  const setIds = [...new Set(printings.map((p) => p.setId))];
  const setRows = setIds.length > 0 ? await repo.setInfoByIds(setIds) : [];
  const setSlugMap = new Map(setRows.map((s) => [s.id, s.slug]));
  const setNameMap = new Map(setRows.map((s) => [s.id, s.name]));

  const setTotals: Record<string, number> = {};
  for (const row of setRows) {
    if (row.printedTotal) {
      setTotals[row.slug] = row.printedTotal;
    }
  }
  const candidateSetSlugs = [
    ...new Set(
      candidatePrintings.filter((cp) => !cp.printingId && cp.setId).map((cp) => cp.setId as string),
    ),
  ].filter((slug) => !(slug in setTotals));
  if (candidateSetSlugs.length > 0) {
    const candidateSetRows = await repo.setPrintedTotalBySlugs(candidateSetSlugs);
    for (const row of candidateSetRows) {
      if (row.printedTotal) {
        setTotals[row.slug] = row.printedTotal;
      }
    }
  }

  const channelLinks = await repo.distributionChannelSlugsForPrintings(printings.map((p) => p.id));
  const channelSlugsByPrinting = new Map<string, string[]>();
  for (const link of channelLinks) {
    const list = channelSlugsByPrinting.get(link.printingId);
    if (list) {
      list.push(link.channelSlug);
    } else {
      channelSlugsByPrinting.set(link.printingId, [link.channelSlug]);
    }
  }

  const formattedPrintings = printings.map(({ setId, ...p }) => ({
    ...p,
    setId: setSlugMap.get(setId) ?? setId,
    setName: setNameMap.get(setId) ?? null,
    setSlug: setSlugMap.get(setId) ?? setId,
    distributionChannelSlugs: channelSlugsByPrinting.get(p.id) ?? [],
    expectedPrintingId: formatPrintingLabel(
      p.shortCode,
      p.markerSlugs,
      p.finish,
      p.language,
      p.size,
    ),
  }));

  const printingIds = printings.map((p) => p.id);
  const printingImages =
    printingIds.length > 0 ? await repo.printingImagesForDetail(printingIds) : [];
  const liveFingerprintsByPrinting = Map.groupBy(
    printingImages.filter((image) => image.face === "front" && image.isActive),
    (image) => image.printingId,
  );

  // Marketplace data is admin-only, so provider-scoped callers (card-review
  // grant holders) get an empty list.
  const marketplaceMappings: AdminPrintingMarketplaceMappingResponse[] = [];
  if (card && marketplaceRepo && allowedProviders === null) {
    const variantRows = await marketplaceRepo.variantsForCard(card.id);
    for (const row of variantRows) {
      const marketplace = toMarketplaceName(row.marketplace);
      if (!marketplace) {
        continue;
      }
      marketplaceMappings.push({
        targetPrintingId: row.targetPrintingId,
        marketplace,
        externalId: row.externalId,
        productName: row.productName,
        finish: row.finish,
        variantLanguage: row.variantLanguage,
        ownerPrintingId: row.ownerPrintingId,
        ownerLanguage: row.ownerLanguage,
      });
    }
  }

  // Linked candidate printings are already shown under their accepted printing.
  const unlinkedCP = candidatePrintings.filter((cp) => !cp.printingId);
  const cpGroupMap = new Map<string, typeof unlinkedCP>();
  for (const cp of unlinkedCP) {
    const slugKey = [...(cp.markerSlugs ?? [])].sort().join(",");
    const key = `${cp.shortCode}|${cp.finish ?? ""}|${slugKey}|${cp.language ?? ""}`;
    let arr = cpGroupMap.get(key);
    if (!arr) {
      arr = [];
      cpGroupMap.set(key, arr);
    }
    arr.push(cp);
  }

  // Closest accepted printing for a candidate group whose exact expected id
  // has no counterpart: same short code (case-insensitive) and language, then
  // ranked by finish match, marker-set distance, and canonical order. Lets the
  // UI offer a one-click link for near-misses (marker or finish drift, e.g. a
  // source reporting `promo` where the catalogue says `launch-exclusive`).
  function findSuggestedPrinting(
    mcShortCode: string,
    finish: string,
    markerSlugs: string[],
    language: string | null,
  ): string | null {
    const wantedCode = mcShortCode.toUpperCase();
    const wantedLanguage = language ?? WellKnown.language.EN;
    const wantedMarkers = new Set(markerSlugs);
    let best: { id: string; score: number; rank: number } | null = null;
    for (const p of formattedPrintings) {
      if (p.shortCode.toUpperCase() !== wantedCode || p.language !== wantedLanguage) {
        continue;
      }
      // Marker distance is asymmetric on purpose. A printing carrying markers
      // the source didn't mention is the common case — sources under-report
      // ("promo" where the catalogue says "prerelease+promo") — while a
      // printing lacking a marker the source did state is a different variant.
      // A symmetric distance ties those two cases, and the canonical-rank
      // tiebreak then hands the suggestion to the unmarked printing.
      // A missing marker also beats a finish mismatch: several sources list
      // VEN-118's foil-only `{promo}` printing as normal, and matching the
      // unmarked normal printing on finish alone is the wrong variant.
      const missing = markerSlugs.filter((s) => !p.markerSlugs.includes(s)).length;
      const extra = p.markerSlugs.filter((s) => !wantedMarkers.has(s)).length;
      const score =
        (p.finish === finish ? 0 : FINISH_MISMATCH_COST) +
        missing * MISSING_MARKER_COST +
        extra * EXTRA_MARKER_COST;
      if (!best || score < best.score || (score === best.score && p.canonicalRank < best.rank)) {
        best = { id: p.id, score, rank: p.canonicalRank };
      }
    }
    return best?.id ?? null;
  }

  const filteredGroups: CandidatePrintingGroupResponse[] = [];
  for (const [, groupCandidates] of cpGroupMap) {
    const [first] = groupCandidates;
    if (!first) {
      continue;
    }
    const mcShortCode = mostCommonValue(groupCandidates.map((s) => s.shortCode));
    const finish = resolveFinish(first.finish, first.rarity);
    const language = mostCommonValue(groupCandidates.map((s) => s.language ?? "")) || null;

    filteredGroups.push({
      mostCommonShortCode: mcShortCode,
      shortCodes: groupCandidates.map((s) => s.id),
      expectedPrintingId: formatPrintingLabel(
        mcShortCode,
        first.markerSlugs ?? [],
        finish,
        language,
      ),
      language,
      suggestedPrintingId: findSuggestedPrinting(
        mcShortCode,
        finish,
        first.markerSlugs ?? [],
        language,
      ),
    });
  }

  const [firstCandidateName] = candidates;
  const displayName = card
    ? card.name
    : firstCandidateName
      ? candidates.reduce(
          (best, s) => (s.name.length < best.length ? s.name : best),
          firstCandidateName.name,
        )
      : fallbackDisplayName;

  return {
    card: card
      ? {
          id: card.id,
          slug: card.slug,
          name: card.name,
          types: card.types,
          superTypes: card.superTypes,
          domains: card.domains,
          might: card.might,
          energy: card.energy,
          power: card.power,
          mightBonus: card.mightBonus,
          keywords: card.keywords,
          errata: errata
            ? {
                announcementId: errata.announcementId,
                correctedRulesText: errata.correctedRulesText,
                correctedEffectText: errata.correctedEffectText,
                source: errata.source,
                sourceUrl: errata.sourceUrl,
                effectiveDate: errata.effectiveDate,
              }
            : null,
          tags: card.tags,
          maxCopiesOverride: card.maxCopiesOverride,
          additionalLegendCount: card.additionalLegendCount,
          comment: card.comment,
        }
      : null,
    displayName,
    sources: candidates.map((s) => formatCandidateCard(s)),
    printings: formattedPrintings.sort((a, b) => a.canonicalRank - b.canonicalRank),
    candidatePrintings: candidatePrintings.map((cp) =>
      formatCandidatePrinting(
        cp,
        cp.printingId === null
          ? null
          : classifyAgainstLive(
              cp.imageFingerprint,
              (liveFingerprintsByPrinting.get(cp.printingId) ?? []).map(
                (image) => image.fingerprint,
              ),
            ),
      ),
    ),
    candidatePrintingGroups: filteredGroups,
    expectedCardId: deriveExpectedCardId(displayName, card?.slug),
    // `rotation` is stored as smallint; the response schema runtime-validates the narrowed literal, so a stray value 500s.
    printingImages: printingImages.map(({ fingerprint: _fingerprint, ...image }) => ({
      ...image,
      rotation: image.rotation as 0 | 90 | 180 | 270,
    })),
    setTotals,
    marketplaceMappings,
  };
}

export async function buildCardDetail(
  repo: Repo,
  marketplaceRepo: MarketplaceMappingRepo,
  cardSlug: string,
  allowedProviders: Set<string> | null = null,
) {
  const card = await repo.cardForDetailBySlug(cardSlug);
  if (!card) {
    return buildDetailResponse(repo, marketplaceRepo, null, null, [], cardSlug, allowedProviders);
  }

  const aliases = await repo.cardNameAliases(card.id);
  if (aliases.length === 0) {
    throw new AppError(
      500,
      ERROR_CODES.MISSING_ALIAS,
      `Card "${card.slug}" has no name aliases — this should never happen. Re-create the alias to fix.`,
    );
  }

  const errata = await repo.cardErrataForDetail(card.id);
  // Always match candidates by the card's own normalized name too, not just its
  // stored aliases. The list view (buildCandidateCardList) matches by
  // card.normName directly plus aliases; mirroring that here keeps the two views
  // consistent even when the self-alias row is missing (e.g. a rename left the
  // old-name alias behind — the norm_name trigger updates cards.norm_name but
  // nothing guarantees a matching alias row exists).
  const normNames = [...new Set([card.normName, ...aliases.map((a) => a.normName)])];
  return buildDetailResponse(
    repo,
    marketplaceRepo,
    card,
    errata,
    normNames,
    card.name,
    allowedProviders,
  );
}

export async function buildUnmatchedDetail(
  repo: Repo,
  normName: string,
  allowedProviders: Set<string> | null = null,
) {
  const result = await buildDetailResponse(
    repo,
    null,
    null,
    null,
    [normName],
    normName,
    allowedProviders,
  );
  return {
    displayName: result.displayName,
    sources: result.sources,
    candidatePrintings: result.candidatePrintings,
    candidatePrintingGroups: result.candidatePrintingGroups,
    defaultCardId: result.expectedCardId,
    setTotals: result.setTotals,
  };
}
