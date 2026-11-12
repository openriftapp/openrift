import { pluralize } from "./strings.js";
import type { ListIntent } from "./types/api/list.js";

const LIST_INTENT_LABEL_EN: Record<ListIntent, string> = {
  wish: "Wishlist",
  trade: "Tradelist",
  organize: "List",
};

export function listIntentLabelEnglish(intent: ListIntent): string {
  return LIST_INTENT_LABEL_EN[intent];
}

function sharedBy(owner: string | null | undefined): string {
  return owner ? ` shared by ${owner}` : "";
}

export function deckShareTitle(name: string, formatLabel: string): string {
  return `${name} (${formatLabel} deck)`;
}

export function deckShareDescription(
  formatLabel: string,
  owner: string | null | undefined,
): string {
  return `A ${formatLabel} Riftbound deck${sharedBy(owner)}.`;
}

export function listShareTitle(name: string, intent: ListIntent): string {
  return `${name} (${listIntentLabelEnglish(intent)})`;
}

export function listShareDescription(intent: ListIntent, owner: string | null | undefined): string {
  return `A Riftbound ${listIntentLabelEnglish(intent).toLowerCase()}${sharedBy(owner)}.`;
}

export function collectionShareTitle(name: string): string {
  return `${name} (collection)`;
}

export function collectionShareDescription(owner: string | null | undefined): string {
  return `A Riftbound card collection${sharedBy(owner)}.`;
}

export function tierListShareTitle(title: string): string {
  return `${title} (tier list)`;
}

export function tierListShareDescription(
  owner: string | null | undefined,
  rankedCount: number,
): string {
  const by = owner ? ` by ${owner}` : "";
  return `A Riftbound tier list${by}, ranking ${rankedCount} ${pluralize(rankedCount, "card")}.`;
}

export function boardShareDescription(owner: string | null | undefined): string {
  return owner ? `A Riftbound board state by ${owner}.` : "A Riftbound board state.";
}

export function userBundleShareTitle(owner: string | null | undefined): string {
  return owner ? `${owner}'s wishlists and tradelists` : "Wishlists and tradelists";
}

export function userBundleShareDescription(
  wishCount: number,
  tradeCount: number,
  totalEntries: number,
): string {
  return `${wishCount} ${pluralize(wishCount, "wishlist")}, ${tradeCount} ${pluralize(tradeCount, "tradelist")}, ${totalEntries} ${pluralize(totalEntries, "card")} in total.`;
}
