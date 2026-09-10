import type { CardmarketFinish } from "./cardmarket-rows";

export interface CardmarketPick {
  idProduct: number;
  finish: CardmarketFinish;
  /** Cardmarket's numeric language id, null when the flag label could not be placed. */
  idLanguage: number | null;
  languageLabel: string | null;
  productName: string;
  quantity: number;
}

export type PickIdentity = Omit<CardmarketPick, "quantity">;

/** Keyed by seller, then by `pickKey`. */
export interface PicksBasket {
  sellers: Record<string, Record<string, CardmarketPick>>;
}

export interface SellerPicks {
  seller: string;
  cards: number;
  copies: number;
}

/** Shape of the URL fragment the OpenRift import page reads; bump `v` on any change. */
export interface PicksPayload {
  v: 1;
  seller: string;
  picks: CardmarketPick[];
}

export const PICKS_STORAGE_KEY = "cardmarketPicks";
export const MAX_PICK_QUANTITY = 99;

export function emptyBasket(): PicksBasket {
  return { sellers: {} };
}

export function pickKey(pick: PickIdentity): string {
  return `${pick.idProduct}:${pick.finish}:${pick.idLanguage ?? 0}`;
}

function isPick(value: unknown): value is CardmarketPick {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const pick = value as Record<string, unknown>;
  return (
    typeof pick.idProduct === "number" &&
    (pick.finish === "normal" || pick.finish === "foil") &&
    (pick.idLanguage === null || typeof pick.idLanguage === "number") &&
    (pick.languageLabel === null || typeof pick.languageLabel === "string") &&
    typeof pick.productName === "string" &&
    typeof pick.quantity === "number" &&
    pick.quantity > 0
  );
}

/** Whatever storage holds, reduced to the picks that still make sense. */
export function readBasket(value: unknown): PicksBasket {
  if (typeof value !== "object" || value === null) {
    return emptyBasket();
  }
  const sellers = (value as Record<string, unknown>).sellers;
  if (typeof sellers !== "object" || sellers === null) {
    return emptyBasket();
  }
  const basket = emptyBasket();
  for (const [seller, picks] of Object.entries(sellers as Record<string, unknown>)) {
    if (typeof picks !== "object" || picks === null) {
      continue;
    }
    const kept = Object.fromEntries(
      Object.entries(picks as Record<string, unknown>).filter(
        (entry): entry is [string, CardmarketPick] => isPick(entry[1]),
      ),
    );
    if (Object.keys(kept).length > 0) {
      basket.sellers[seller] = kept;
    }
  }
  return basket;
}

export function pickedQuantity(basket: PicksBasket, seller: string, pick: PickIdentity): number {
  return basket.sellers[seller]?.[pickKey(pick)]?.quantity ?? 0;
}

/** A new basket with the pick's quantity moved by `delta`, clamped to 0..MAX and pruned at 0. */
export function adjustPick(
  basket: PicksBasket,
  seller: string,
  pick: PickIdentity,
  delta: number,
): PicksBasket {
  const key = pickKey(pick);
  const current = basket.sellers[seller] ?? {};
  const quantity = Math.min(MAX_PICK_QUANTITY, Math.max(0, (current[key]?.quantity ?? 0) + delta));

  const nextPicks =
    quantity === 0 ? without(current, key) : { ...current, [key]: { ...pick, quantity } };
  if (Object.keys(nextPicks).length === 0) {
    return removeSeller(basket, seller);
  }
  return { sellers: { ...basket.sellers, [seller]: nextPicks } };
}

function without<Value>(record: Record<string, Value>, key: string): Record<string, Value> {
  return Object.fromEntries(Object.entries(record).filter(([entry]) => entry !== key));
}

export function removeSeller(basket: PicksBasket, seller: string): PicksBasket {
  return { sellers: without(basket.sellers, seller) };
}

export function sellerPicks(basket: PicksBasket): SellerPicks[] {
  return Object.entries(basket.sellers)
    .map(([seller, picks]) => {
      const list = Object.values(picks);
      return {
        seller,
        cards: list.length,
        copies: list.reduce((sum, pick) => sum + pick.quantity, 0),
      };
    })
    .toSorted((a, b) => a.seller.localeCompare(b.seller));
}

export function basketCopies(basket: PicksBasket): number {
  return sellerPicks(basket).reduce((sum, entry) => sum + entry.copies, 0);
}

export function picksPayload(basket: PicksBasket, seller: string): PicksPayload | undefined {
  const picks = Object.values(basket.sellers[seller] ?? {});
  if (picks.length === 0) {
    return undefined;
  }
  return { v: 1, seller, picks };
}

export function sellerPicksText(entry: SellerPicks): string {
  const cards = `${entry.cards} card${entry.cards === 1 ? "" : "s"}`;
  const copies = entry.copies === entry.cards ? "" : ` (${entry.copies} copies)`;
  return `${cards}${copies} from ${entry.seller}`;
}
