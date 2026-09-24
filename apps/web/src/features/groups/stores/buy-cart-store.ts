import type { Marketplace } from "@openrift/shared/types/pricing";
import { ALL_MARKETPLACES } from "@openrift/shared/types/pricing";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { BuyCartItem, UserCart } from "@/features/groups/lib/buy-cart";
import { cartFor, withPrinting } from "@/features/groups/lib/buy-cart";

interface BuyCartState {
  carts: Record<string, UserCart>;
  marketplace: Marketplace;
  addItems: (userId: string, items: readonly BuyCartItem[]) => void;
  removeItems: (userId: string, keys: readonly string[]) => void;
  clear: (userId: string) => void;
  setMarketplace: (marketplace: Marketplace) => void;
  setPrinting: (userId: string, key: string, printingId: string) => void;
}

function parseItem(value: unknown): BuyCartItem | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.key === "string" &&
    typeof raw.cardId === "string" &&
    typeof raw.printingId === "string" &&
    typeof raw.quantity === "number" &&
    Number.isInteger(raw.quantity) &&
    raw.quantity > 0
  ) {
    return { key: raw.key, cardId: raw.cardId, printingId: raw.printingId, quantity: raw.quantity };
  }
  return null;
}

function parseCart(value: unknown): UserCart | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const items = Array.isArray(raw.items)
    ? raw.items.flatMap((item) => {
        const parsed = parseItem(item);
        return parsed === null ? [] : [parsed];
      })
    : [];
  return { items };
}

function parseCarts(value: unknown): Record<string, UserCart> {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  const carts: Record<string, UserCart> = {};
  for (const [userId, cart] of Object.entries(value)) {
    const parsed = parseCart(cart);
    if (parsed !== null) {
      carts[userId] = parsed;
    }
  }
  return carts;
}

function parseMarketplace(value: unknown): Marketplace {
  return ALL_MARKETPLACES.find((marketplace) => marketplace === value) ?? "cardtrader";
}

export const useBuyCartStore = create<BuyCartState>()(
  persist(
    (set) => {
      const updateCart = (userId: string, update: (cart: UserCart) => UserCart) =>
        set((state) => ({
          carts: { ...state.carts, [userId]: update(cartFor(state.carts, userId)) },
        }));
      return {
        carts: {},
        marketplace: "cardtrader",
        addItems: (userId, items) =>
          updateCart(userId, (cart) => {
            const byKey = new Map(cart.items.map((item) => [item.key, item]));
            for (const item of items) {
              byKey.set(item.key, item);
            }
            return { ...cart, items: [...byKey.values()] };
          }),
        removeItems: (userId, keys) =>
          updateCart(userId, (cart) => ({
            ...cart,
            items: cart.items.filter((item) => !keys.includes(item.key)),
          })),
        clear: (userId) => updateCart(userId, (cart) => ({ ...cart, items: [] })),
        setMarketplace: (marketplace) => set({ marketplace }),
        setPrinting: (userId, key, printingId) =>
          updateCart(userId, (cart) => ({
            ...cart,
            items: withPrinting(cart.items, key, printingId),
          })),
      };
    },
    {
      name: "openrift-buy-cart",
      partialize: (state) => ({ carts: state.carts, marketplace: state.marketplace }),
      merge: (persisted, current) => {
        const raw = (persisted as Record<string, unknown>) ?? {};
        return {
          ...current,
          carts: parseCarts(raw.carts),
          marketplace: parseMarketplace(raw.marketplace),
        };
      },
    },
  ),
);
