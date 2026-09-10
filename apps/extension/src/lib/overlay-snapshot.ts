import type { CardmarketFinish } from "./cardmarket-rows";

export interface OverlayCounts {
  owned: number;
  wanted: number;
  /** Headline price of the viewer's own marketplace, in that marketplace's cents. */
  priceCents: number | null;
}

export interface OverlayList {
  id: string;
  name: string;
  entryCount?: number;
}

export interface OverlaySnapshot {
  lists: OverlayList[];
  marketplace: OverlayMarketplace;
  generatedAt: string;
  capturedAt: string;
  /** Keyed by `<product id>:<finish>`, because one product id exists in both finishes. */
  products: Record<string, OverlayCounts>;
}

export const SNAPSHOT_STORAGE_KEY = "cardmarketOverlaySnapshot";

export const OVERLAY_MARKETPLACES = ["cardmarket", "tcgplayer", "cardtrader"] as const;

export type OverlayMarketplace = (typeof OVERLAY_MARKETPLACES)[number];

const EMPTY_COUNTS: OverlayCounts = { owned: 0, wanted: 0, priceCents: null };

function isMarketplace(value: unknown): value is OverlayMarketplace {
  return OVERLAY_MARKETPLACES.includes(value as OverlayMarketplace);
}

const PAYLOAD_SELECTOR = 'script[type="application/json"][data-openrift-overlay-snapshot]';

interface SnapshotProductRow {
  idProduct: number;
  finish: CardmarketFinish;
  owned: number;
  wanted: number;
  priceCents: number | null;
}

export function productKey(idProduct: number, finish: CardmarketFinish): string {
  return `${idProduct}:${finish}`;
}

function isList(value: unknown): value is OverlayList {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const list = value as Record<string, unknown>;
  return (
    typeof list.id === "string" &&
    typeof list.name === "string" &&
    (list.entryCount === undefined || typeof list.entryCount === "number")
  );
}

function isProductRow(value: unknown): value is SnapshotProductRow {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.idProduct === "number" &&
    (row.finish === "normal" || row.finish === "foil") &&
    typeof row.owned === "number" &&
    typeof row.wanted === "number" &&
    (row.priceCents === null || typeof row.priceCents === "number")
  );
}

/** Reads the hand-off block the OpenRift sync page renders. Returns undefined if the page has none. */
export function readSnapshotFromPage(
  doc: Document,
  capturedAt: string,
): OverlaySnapshot | undefined {
  const element = doc.querySelector(PAYLOAD_SELECTOR);
  if (element === null || element.textContent === null) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(element.textContent);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return undefined;
  }

  const payload = parsed as Record<string, unknown>;
  if (
    typeof payload.generatedAt !== "string" ||
    !Array.isArray(payload.products) ||
    !Array.isArray(payload.lists)
  ) {
    return undefined;
  }
  const lists = payload.lists.filter(isList);
  if (lists.length === 0 || !isMarketplace(payload.marketplace)) {
    return undefined;
  }

  const products: Record<string, OverlayCounts> = {};
  for (const row of payload.products) {
    if (isProductRow(row)) {
      products[productKey(row.idProduct, row.finish)] = {
        owned: row.owned,
        wanted: row.wanted,
        priceCents: row.priceCents,
      };
    }
  }

  return {
    lists,
    marketplace: payload.marketplace,
    generatedAt: payload.generatedAt,
    capturedAt,
    products,
  };
}

export function countsForProduct(
  snapshot: OverlaySnapshot,
  idProduct: number | undefined,
  finish: CardmarketFinish,
): OverlayCounts {
  if (idProduct === undefined) {
    return EMPTY_COUNTS;
  }
  return snapshot.products[productKey(idProduct, finish)] ?? EMPTY_COUNTS;
}
