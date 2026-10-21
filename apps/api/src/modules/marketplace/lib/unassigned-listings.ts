import type { Marketplace } from "@openrift/shared/types/pricing";

export interface UnassignedListing {
  marketplace: Marketplace;
  externalId: number;
  finish: string;
  language: string | null;
  productName: string;
  createdAt: Date;
}

interface SuggestedListing extends UnassignedListing {
  printingId: string;
  printingLabel: string;
  cardSlug: string;
  cardName: string;
  score: number;
  strength: "strong" | "suggested";
}

export interface UnmatchedListing extends UnassignedListing {
  card: { slug: string; name: string } | null;
}

export interface UnassignedListings {
  suggested: SuggestedListing[];
  unmatched: UnmatchedListing[];
}
