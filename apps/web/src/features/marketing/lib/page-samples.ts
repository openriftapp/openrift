import { imageUrl } from "@openrift/shared/image-url";
import type { LandingSummaryResponse } from "@openrift/shared/types/api/catalog";

import type { LandingThumbnailCard } from "@/features/marketing/lib/landing-thumbnails";
import { landingThumbnailCards } from "@/features/marketing/lib/landing-thumbnails";

function takeFrom(cards: LandingThumbnailCard[]) {
  let next = 0;
  return (count: number): LandingThumbnailCard[] => {
    const slice = cards.slice(next, next + count);
    next += count;
    return slice;
  };
}

function urls(cards: LandingThumbnailCard[]): string[] {
  return cards.map((card) => card.url);
}

export interface LandingSamples {
  fanUrls: string[];
  scanCards: LandingThumbnailCard[];
  groupUrls: string[];
}

/** Disjoint slices of the sample, so no card shows twice on the page. */
export function landingSamples(data: LandingSummaryResponse | undefined): LandingSamples {
  const take = takeFrom(landingThumbnailCards(data?.thumbnails));
  return {
    fanUrls: urls(take(5)),
    scanCards: take(4),
    groupUrls: urls(take(8)),
  };
}

export interface FeaturesSamples {
  catalogCards: LandingThumbnailCard[];
  heroUrls: string[];
  collectionsUrls: string[];
  scanCards: LandingThumbnailCard[];
  trackerUrls: string[];
  discordCard: LandingThumbnailCard | undefined;
  tradedCard: LandingThumbnailCard | undefined;
  groupUrls: string[];
  tradeMatchUrls: string[];
  testUrls: string[];
  stageUrls: string[];
  legendUrls: string[];
}

/** Disjoint slices of the sample, so no card shows twice on the page. */
export function featuresSamples(
  data: LandingSummaryResponse | undefined,
  { scanner }: { scanner: boolean },
): FeaturesSamples {
  const cards = landingThumbnailCards(data?.thumbnails);
  const take = takeFrom(cards);
  const heroUrls = urls(take(5));
  const collectionsUrls = urls(take(3));
  const scanCards = scanner ? take(4) : [];
  const trackerUrls = urls(take(2));
  const [discordCard] = take(1);
  const [tradedCard] = take(1);
  return {
    catalogCards: cards,
    heroUrls,
    collectionsUrls,
    scanCards,
    trackerUrls,
    discordCard,
    tradedCard,
    groupUrls: urls(take(8)),
    tradeMatchUrls: urls(take(6)),
    testUrls: urls(take(5)),
    stageUrls: urls(take(1)),
    legendUrls: (data?.legendThumbnailIds ?? []).map((id) => imageUrl(id, "400w")),
  };
}
