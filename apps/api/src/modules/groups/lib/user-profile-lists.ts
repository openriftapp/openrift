import type { ListIntent, ListKind } from "@openrift/shared/types/api/list";

import type { ListEntryRow } from "../../lists/repositories/lists-shared.js";

export const PREVIEW_IMAGE_COUNT = 4;

const PREVIEW_CANDIDATES = PREVIEW_IMAGE_COUNT * 3;

export interface ExpandedList {
  listId: string;
  entryCount: number;
  cardIds: Set<string>;
  previewImageIds: string[];
}

export interface OverlapCounts {
  theyWantYouHave: number;
  theyOfferYouWant: number;
  perList: Map<string, number>;
}

interface ListRef {
  id: string;
  kind: ListKind;
  intent: ListIntent;
}

export interface ProfileListRepos {
  lists: {
    entriesWithDetailsAnon: (listId: string, kind: ListKind) => Promise<ListEntryRow[]>;
    entriesWithDetails: (listId: string, kind: ListKind, userId: string) => Promise<ListEntryRow[]>;
    listForUser: (userId: string, intent?: ListIntent) => Promise<ListRef[]>;
  };
  userProfile: {
    cardIdsForPrintings: (printingIds: readonly string[]) => Promise<Map<string, string>>;
  };
  canonicalPrintings: {
    resolvePrintingMetaForRows: (
      rows: { cardId: string; preferredPrintingId: string | null }[],
    ) => Promise<{ cardId: string; imageId: string | null }[]>;
  };
}

function cardIdOf(row: ListEntryRow, cardByPrinting: Map<string, string>): string | null {
  return row.kind === "card" ? row.cardId : (cardByPrinting.get(row.printingId) ?? null);
}

function cardIdsByPrinting(
  repos: Pick<ProfileListRepos, "userProfile">,
  rows: readonly ListEntryRow[],
): Promise<Map<string, string>> {
  const printingIds = [
    ...new Set(rows.flatMap((row) => (row.kind === "card" ? [] : [row.printingId]))),
  ];
  return repos.userProfile.cardIdsForPrintings(printingIds);
}

async function previewImageIds(
  repos: Pick<ProfileListRepos, "canonicalPrintings">,
  rows: readonly ListEntryRow[],
): Promise<string[]> {
  const candidates = rows.slice(0, PREVIEW_CANDIDATES);
  const cardKindIds = [
    ...new Set(candidates.flatMap((row) => (row.kind === "card" ? [row.cardId] : []))),
  ];
  const cardImage = new Map<string, string | null>();
  if (cardKindIds.length > 0) {
    const metas = await repos.canonicalPrintings.resolvePrintingMetaForRows(
      cardKindIds.map((cardId) => ({ cardId, preferredPrintingId: null })),
    );
    for (const meta of metas) {
      cardImage.set(meta.cardId, meta.imageId);
    }
  }
  const seen = new Set<string>();
  for (const row of candidates) {
    const imageId = row.kind === "card" ? (cardImage.get(row.cardId) ?? null) : row.imageId;
    if (imageId !== null) {
      seen.add(imageId);
    }
    if (seen.size === PREVIEW_IMAGE_COUNT) {
      break;
    }
  }
  return [...seen];
}

/** Expands the owner's visible lists once, for the entry count, the art row and the overlap. */
export async function expandOwnerLists(
  repos: ProfileListRepos,
  lists: readonly Pick<ListRef, "id" | "kind">[],
): Promise<Map<string, ExpandedList>> {
  const expanded = await Promise.all(
    lists.map(async (list) => {
      const rows = await repos.lists.entriesWithDetailsAnon(list.id, list.kind);
      const [cardByPrinting, previews] = await Promise.all([
        cardIdsByPrinting(repos, rows),
        previewImageIds(repos, rows),
      ]);
      const cardIds = new Set<string>();
      for (const row of rows) {
        const cardId = cardIdOf(row, cardByPrinting);
        if (cardId !== null) {
          cardIds.add(cardId);
        }
      }
      return {
        listId: list.id,
        entryCount: rows.length,
        cardIds,
        previewImageIds: previews,
      };
    }),
  );
  return new Map(expanded.map((list) => [list.listId, list]));
}

/** Every card on the viewer's own lists of one intent, private lists included. */
async function viewerCardSet(
  repos: ProfileListRepos,
  viewerUserId: string,
  intent: "wish" | "trade",
): Promise<Set<string>> {
  const lists = await repos.lists.listForUser(viewerUserId, intent);
  const cards = new Set<string>();
  await Promise.all(
    lists.map(async (list) => {
      const rows = await repos.lists.entriesWithDetails(list.id, list.kind, viewerUserId);
      const cardByPrinting = await cardIdsByPrinting(repos, rows);
      for (const row of rows) {
        const cardId = cardIdOf(row, cardByPrinting);
        if (cardId !== null) {
          cards.add(cardId);
        }
      }
    }),
  );
  return cards;
}

function intersectionSize(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  let count = 0;
  for (const value of left) {
    if (right.has(value)) {
      count += 1;
    }
  }
  return count;
}

/** Distinct cards on the owner's visible lists that sit on the viewer's opposite-intent lists; quantities are not netted. */
export async function overlapWithViewer(
  repos: ProfileListRepos,
  viewerUserId: string,
  ownerLists: readonly ListRef[],
  expanded: ReadonlyMap<string, ExpandedList>,
): Promise<OverlapCounts> {
  const [viewerWish, viewerTrade] = await Promise.all([
    viewerCardSet(repos, viewerUserId, "wish"),
    viewerCardSet(repos, viewerUserId, "trade"),
  ]);
  const ownerWish = new Set<string>();
  const ownerTrade = new Set<string>();
  const perList = new Map<string, number>();
  for (const list of ownerLists) {
    const cards = expanded.get(list.id)?.cardIds ?? new Set<string>();
    const target = list.intent === "wish" ? ownerWish : ownerTrade;
    for (const cardId of cards) {
      target.add(cardId);
    }
    const counterpart = list.intent === "wish" ? viewerTrade : viewerWish;
    perList.set(list.id, intersectionSize(cards, counterpart));
  }
  return {
    theyWantYouHave: intersectionSize(ownerWish, viewerTrade),
    theyOfferYouWant: intersectionSize(ownerTrade, viewerWish),
    perList,
  };
}
