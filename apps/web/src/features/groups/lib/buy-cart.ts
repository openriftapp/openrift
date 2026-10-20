import type { CartWizardLine, MassEntryLine } from "@openrift/shared/marketplace";
import type { CollectionResponse } from "@openrift/shared/types/api/collection";

import type { CardLine } from "@/lib/export-text";

import type { WantedCard, WishDecrement } from "./wanted-cards";
import { wishDecrements } from "./wanted-cards";

export interface BuyCartItem {
  key: string;
  cardId: string;
  printingId: string;
  quantity: number;
}

export interface UserCart {
  items: BuyCartItem[];
}

const EMPTY_CART: UserCart = { items: [] };

export function cartFor(carts: Record<string, UserCart>, userId: string): UserCart {
  return carts[userId] ?? EMPTY_CART;
}

export function cartItemForWanted(
  wanted: WantedCard,
  shownPrintingId: string | undefined,
): BuyCartItem | null {
  const printingId = wanted.printingId ?? shownPrintingId;
  if (printingId === undefined) {
    return null;
  }
  return { key: wanted.key, cardId: wanted.cardId, printingId, quantity: wanted.quantity };
}

/**
 * The copies to buy: wishes for one card add up, and one double-sided copy fills a wish for each
 * of its cards, so a printing takes its largest per-card total.
 */
export function cartPurchaseItems(items: readonly BuyCartItem[]): BuyCartItem[] {
  const totalByCard = new Map<string, BuyCartItem>();
  for (const item of items) {
    const key = `${item.printingId}\0${item.cardId}`;
    const existing = totalByCard.get(key);
    totalByCard.set(
      key,
      existing ? { ...existing, quantity: existing.quantity + item.quantity } : item,
    );
  }
  const byPrinting = new Map<string, BuyCartItem>();
  for (const item of totalByCard.values()) {
    const existing = byPrinting.get(item.printingId);
    if (!existing || item.quantity > existing.quantity) {
      byPrinting.set(item.printingId, item);
    }
  }
  return [...byPrinting.values()];
}

export function cartCopyCount(items: readonly BuyCartItem[]): number {
  return cartPurchaseItems(items).reduce((sum, item) => sum + item.quantity, 0);
}

export function cartCardLines(
  items: readonly BuyCartItem[],
  nameOf: (item: BuyCartItem) => string,
): CardLine[] {
  return cartPurchaseItems(items).map((item) => ({ name: nameOf(item), quantity: item.quantity }));
}

export function massEntryLines(
  items: readonly BuyCartItem[],
  productIdOf: (printingId: string) => number | null | undefined,
): { lines: MassEntryLine[]; unlisted: BuyCartItem[] } {
  const lines: MassEntryLine[] = [];
  const unlisted: BuyCartItem[] = [];
  for (const item of cartPurchaseItems(items)) {
    const productId = productIdOf(item.printingId);
    if (productId === null || productId === undefined) {
      unlisted.push(item);
    } else {
      lines.push({ productId, quantity: item.quantity });
    }
  }
  return { lines, unlisted };
}

export function cartWizardLines(
  items: readonly BuyCartItem[],
  productIdOf: (printingId: string) => number | null | undefined,
  printingOf: (printingId: string) => { language: string; finish: string } | undefined,
): { lines: CartWizardLine[]; unlisted: BuyCartItem[] } {
  const lines: CartWizardLine[] = [];
  const unlisted: BuyCartItem[] = [];
  for (const item of cartPurchaseItems(items)) {
    const productId = productIdOf(item.printingId);
    if (productId === null || productId === undefined) {
      unlisted.push(item);
    } else {
      const printing = printingOf(item.printingId);
      lines.push({
        productId,
        quantity: item.quantity,
        language: printing?.language,
        finish: printing?.finish,
      });
    }
  }
  return { lines, unlisted };
}

export function cartTotal(
  items: readonly BuyCartItem[],
  priceOf: (printingId: string) => number | undefined,
): { total: number; unpriced: number } {
  let total = 0;
  let unpriced = 0;
  for (const item of cartPurchaseItems(items)) {
    const price = priceOf(item.printingId);
    if (price === undefined) {
      unpriced += item.quantity;
    } else {
      total += price * item.quantity;
    }
  }
  return { total, unpriced };
}

const COPIES_PER_REQUEST = 500;

export function findOrderedCollection(
  collections: readonly CollectionResponse[],
): CollectionResponse | undefined {
  return collections.find((collection) => collection.purpose === "marketplace_orders");
}

export interface FileOrderDeps {
  collectionId: () => Promise<string>;
  addCopies: (copies: { printingId: string; collectionId: string }[]) => Promise<unknown>;
  decrementEntries: (decrements: WishDecrement[]) => Promise<unknown>;
}

export async function fileOrder(
  deps: FileOrderDeps,
  items: readonly BuyCartItem[],
  wantedByKey: ReadonlyMap<string, WantedCard>,
): Promise<void> {
  const collectionId = await deps.collectionId();
  const copies = cartPurchaseItems(items).flatMap((item) =>
    Array.from({ length: item.quantity }, () => ({ printingId: item.printingId, collectionId })),
  );
  for (let start = 0; start < copies.length; start += COPIES_PER_REQUEST) {
    await deps.addCopies(copies.slice(start, start + COPIES_PER_REQUEST));
  }
  const decrements = items.flatMap((item) =>
    wishDecrements(wantedByKey.get(item.key)?.entries ?? [], item.quantity),
  );
  if (decrements.length === 0) {
    return;
  }
  try {
    await deps.decrementEntries(decrements);
  } catch {
    // The copies are in by now, so a failed wish update must not make a retry file them twice.
  }
}

export function withPrinting(
  items: readonly BuyCartItem[],
  key: string,
  printingId: string,
): BuyCartItem[] {
  return items.map((item) => (item.key === key ? { ...item, printingId } : item));
}
