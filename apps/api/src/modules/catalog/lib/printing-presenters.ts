import type {
  CatalogCardResponse,
  CatalogPrintingResponse,
  CatalogPrintingSideValue,
} from "@openrift/shared/types/api/catalog";
import type {
  DistributionChannelKind,
  Marker,
  PrintingCitation,
  PrintingDistributionChannel,
  PrintingImage,
} from "@openrift/shared/types/catalog";

import type { Repos } from "../../../deps.js";

interface PrintingDecorations {
  markerBySlug: Map<string, Marker>;
  channelsByPrinting: Map<string, PrintingDistributionChannel[]>;
  citationsByPrinting: Map<string, PrintingCitation[]>;
}

type CardRow = Awaited<ReturnType<Repos["catalog"]["cardsByIds"]>>[number];
type CardBanRow = Awaited<ReturnType<Repos["catalog"]["cardBansByCardIds"]>>[number];
type CardErrataRow = Awaited<ReturnType<Repos["catalog"]["cardErrataByCardIds"]>>[number];
type SideRow = Awaited<ReturnType<Repos["catalog"]["printings"]>>[number];
type PrintingRow = Awaited<ReturnType<Repos["catalog"]["printingsBySetId"]>>[number] & {
  slug?: string;
};
type PrintingImageRow = Awaited<
  ReturnType<Repos["catalog"]["printingImagesByPrintingIds"]>
>[number];

export async function loadPrintingDecorations(
  repos: Repos,
  printingIds: readonly string[],
): Promise<PrintingDecorations> {
  const [markerRows, channelRows, allChannels, citationRows] = await Promise.all([
    repos.catalog.markersList(),
    repos.distributionChannels.listForPrintingIds(printingIds),
    repos.distributionChannels.listAll(),
    repos.printingCitations.listForPrintingIds(printingIds),
  ]);

  const markerBySlug = new Map<string, Marker>(markerRows.map((m) => [m.slug, m]));

  const channelById = new Map(allChannels.map((c) => [c.id, c]));
  function ancestorLabelsFor(startId: string | null): string[] {
    const labels: string[] = [];
    let cursor = startId;
    let depth = 0;
    while (cursor !== null && depth < 32) {
      const parent = channelById.get(cursor);
      if (!parent) {
        break;
      }
      labels.unshift(parent.label);
      cursor = parent.parentId;
      depth += 1;
    }
    return labels;
  }

  const channelsByPrinting = new Map<string, PrintingDistributionChannel[]>();
  for (const row of channelRows) {
    const link: PrintingDistributionChannel = {
      channel: {
        id: row.channelId,
        slug: row.channelSlug,
        label: row.channelLabel,
        description: row.channelDescription,
        kind: row.channelKind as DistributionChannelKind,
        parentId: row.channelParentId,
        childrenLabel: row.channelChildrenLabel,
      },
      distributionNote: row.distributionNote,
      ancestorLabels: ancestorLabelsFor(row.channelParentId),
    };
    const list = channelsByPrinting.get(row.printingId);
    if (list) {
      list.push(link);
    } else {
      channelsByPrinting.set(row.printingId, [link]);
    }
  }

  // The repo returns these in display order; grouping preserves it.
  const citationsByPrinting = new Map<string, PrintingCitation[]>();
  for (const row of citationRows) {
    const citation: PrintingCitation = {
      id: row.id,
      label: row.label,
      sourceUrl: row.sourceUrl,
    };
    const list = citationsByPrinting.get(row.printingId);
    if (list) {
      list.push(citation);
    } else {
      citationsByPrinting.set(row.printingId, [citation]);
    }
  }

  return { markerBySlug, channelsByPrinting, citationsByPrinting };
}

/** Wire invariant: `fallbackArtMode: "pinned"` always arrives with a `fallbackImageId`. */
export function resolveFallbackArt(row: {
  fallbackArtMode: string;
  fallbackImageId: string | null;
}): Pick<CatalogPrintingResponse, "fallbackArtMode" | "fallbackImageId"> {
  if (row.fallbackArtMode === "none") {
    return { fallbackArtMode: "none" };
  }
  if (row.fallbackArtMode === "pinned" && row.fallbackImageId !== null) {
    return { fallbackArtMode: "pinned", fallbackImageId: row.fallbackImageId };
  }
  return {};
}

/** The credit key stays absent unless set: most of the catalogue is uncredited and every visitor downloads it. */
export function toCatalogPrintingImage(row: {
  imageId: string;
  credit: string | null;
}): PrintingImage {
  return {
    imageId: row.imageId,
    ...(row.credit === null ? {} : { credit: row.credit }),
  };
}

function resolveFoilTwin(row: {
  hasFoilTwin: boolean;
}): Pick<CatalogPrintingResponse, "hasFoilTwin"> {
  return row.hasFoilTwin ? { hasFoilTwin: true } : {};
}

/** Skips slugs missing from the map (defensive for stale denormalized data). */
export function resolveMarkers(
  markerSlugs: readonly string[],
  markerBySlug: ReadonlyMap<string, Marker>,
): Marker[] {
  return markerSlugs
    .map((slug) => markerBySlug.get(slug))
    .filter((m): m is Marker => m !== undefined);
}

export function buildCardsResponse(
  cardRows: readonly CardRow[],
  banRows: readonly CardBanRow[],
  errataRows: readonly CardErrataRow[],
): Record<string, CatalogCardResponse> {
  const bansByCard = Map.groupBy(banRows, (r) => r.cardId);
  const errataByCard = new Map(
    errataRows.map((r) => [
      r.cardId,
      {
        correctedRulesText: r.correctedRulesText,
        correctedEffectText: r.correctedEffectText,
        source: r.source,
        sourceUrl: r.sourceUrl,
        effectiveDate: r.effectiveDate,
      },
    ]),
  );

  return Object.fromEntries(
    cardRows.map((r) => [
      r.id,
      {
        ...r,
        errata: errataByCard.get(r.id) ?? null,
        bans: (bansByCard.get(r.id) ?? []).map((b) => ({
          formatId: b.formatId,
          formatName: b.formatName,
          bannedAt: b.bannedAt,
          reason: b.reason,
        })),
      },
    ]),
  );
}

export function sideImageKey(row: { printingId: string; side: number }): string {
  return `${row.printingId}:${row.side}`;
}

export function presentSide(
  row: SideRow,
  images: readonly PrintingImageRow[],
  markerBySlug: ReadonlyMap<string, Marker>,
): CatalogPrintingSideValue {
  return {
    faceId: row.faceId,
    cardId: row.cardId,
    setId: row.setId,
    shortCode: row.shortCode,
    rarity: row.rarity,
    artVariant: row.artVariant,
    isSigned: row.isSigned,
    isOvernumbered: row.isOvernumbered,
    markers: resolveMarkers(row.markerSlugs, markerBySlug),
    finish: row.finish,
    images: images.map((image) => toCatalogPrintingImage(image)),
    artist: row.artist,
    publicCode: row.publicCode,
    printedRulesText: row.printedRulesText,
    printedEffectText: row.printedEffectText,
    flavorText: row.flavorText,
    printedName: row.printedName,
    printedYear: row.printedYear,
    language: row.language,
    canonicalRank: row.canonicalRank,
    ...resolveFallbackArt(row),
  };
}

export function presentPrintingFields(
  row: SideRow,
  decorations: Pick<PrintingDecorations, "channelsByPrinting" | "citationsByPrinting">,
): Pick<
  CatalogPrintingResponse,
  "size" | "comment" | "hasFoilTwin" | "distributionChannels" | "citations"
> {
  const citations = decorations.citationsByPrinting.get(row.printingId);
  return {
    size: row.size,
    comment: row.comment,
    ...resolveFoilTwin(row),
    distributionChannels: decorations.channelsByPrinting.get(row.printingId) ?? [],
    ...(citations === undefined ? {} : { citations }),
  };
}

export function buildPrintingsResponse(
  printingRows: readonly PrintingRow[],
  imageRows: readonly PrintingImageRow[],
  decorations: PrintingDecorations,
): CatalogPrintingResponse[] {
  const imagesBySide = Map.groupBy(imageRows, sideImageKey);
  return printingRows.map((row) => ({
    printingId: row.printingId,
    side: row.side,
    ...(row.otherSide === null ? {} : { otherSide: row.otherSide }),
    ...(row.slug === undefined ? {} : { slug: row.slug }),
    ...presentSide(row, imagesBySide.get(sideImageKey(row)) ?? [], decorations.markerBySlug),
    ...presentPrintingFields(row, decorations),
  }));
}
