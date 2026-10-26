import type { Marketplace } from "./types/pricing.js";
import { ALL_MARKETPLACES } from "./types/pricing.js";

export interface ListingSku {
  marketplace: Marketplace;
  externalId: number;
  finish: string;
  language: string | null;
}

const PREFIX = "listing";

export function listingOwnerId(sku: ListingSku): string {
  const parts = [PREFIX, sku.marketplace, String(sku.externalId), sku.finish];
  return (sku.language === null ? parts : [...parts, sku.language]).join(":");
}

export function isListingOwnerId(ownerId: string): boolean {
  return ownerId.startsWith(`${PREFIX}:`);
}

export function parseListingOwnerId(ownerId: string): ListingSku | null {
  const [prefix, marketplace, externalId, finish, language, ...rest] = ownerId.split(":");
  const id = Number(externalId);
  if (
    prefix !== PREFIX ||
    rest.length > 0 ||
    !ALL_MARKETPLACES.includes(marketplace as Marketplace) ||
    !Number.isInteger(id) ||
    finish === undefined ||
    finish === "" ||
    language === ""
  ) {
    return null;
  }
  return {
    marketplace: marketplace as Marketplace,
    externalId: id,
    finish,
    language: language ?? null,
  };
}

const CARD_PREFIX = "listing-card";

export function listingCardOwnerId(cardSlug: string): string {
  return `${CARD_PREFIX}:${cardSlug}`;
}

export function parseListingCardOwnerId(ownerId: string): string | null {
  const slug = ownerId.startsWith(`${CARD_PREFIX}:`) ? ownerId.slice(CARD_PREFIX.length + 1) : "";
  return slug === "" ? null : slug;
}
