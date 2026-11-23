import type {
  ReviewCard,
  WorkspaceQueueItem,
} from "@openrift/shared/contracts/admin/catalog-workspace";

interface CardAccumulator {
  key: string;
  cardSlug: string | null;
  cardName: string;
  hasContribution: boolean;
  providers: Set<string>;
  cardFields: Set<string>;
  newPrintings: Set<string>;
  faces: Set<string>;
  printings: Set<string>;
  newImages: number;
  failedImages: number;
  waitingSince: string;
}

function cardKey(item: WorkspaceQueueItem): string | null {
  if (item.reason === "listing") {
    return null;
  }
  if (item.cardSlug !== null) {
    return item.cardSlug;
  }
  return item.reason === "new-card" ? `new:${item.ownerId}` : null;
}

function addItem(card: CardAccumulator, item: WorkspaceQueueItem): void {
  // Desk uploads are flagged like contributions but carry no provider and need no reply.
  if (item.isContributor && item.provider !== null) {
    card.hasContribution = true;
  }
  if (item.provider !== null) {
    card.providers.add(item.provider);
  }
  if (item.createdAt < card.waitingSince) {
    card.waitingSince = item.createdAt;
  }
  if (item.reason === "new-printing") {
    card.newPrintings.add(item.label);
  } else if (item.reason === "new-image") {
    card.newImages += 1;
  } else if (item.reason === "image-rehost-failed") {
    card.failedImages += 1;
  } else if (item.reason === "source-difference" || item.reason === "contributor-proposal") {
    if (item.owner === "card") {
      for (const field of item.fields) {
        card.cardFields.add(field);
      }
    } else {
      card[item.owner === "face" ? "faces" : "printings"].add(item.ownerId);
    }
  }
}

/** One row per card with pending work: contributions first, then the longest wait. */
export function toReviewCards(items: readonly WorkspaceQueueItem[]): ReviewCard[] {
  const byKey = new Map<string, CardAccumulator>();
  for (const item of items) {
    const key = cardKey(item);
    if (key === null) {
      continue;
    }
    let card = byKey.get(key);
    if (card === undefined) {
      card = {
        key,
        cardSlug: item.cardSlug,
        cardName: item.cardName,
        hasContribution: false,
        providers: new Set(),
        cardFields: new Set(),
        newPrintings: new Set(),
        faces: new Set(),
        printings: new Set(),
        newImages: 0,
        failedImages: 0,
        waitingSince: item.createdAt,
      };
      byKey.set(key, card);
    }
    addItem(card, item);
  }
  return [...byKey.values()]
    .map((card) => ({
      key: card.key,
      cardSlug: card.cardSlug,
      cardName: card.cardName,
      hasContribution: card.hasContribution,
      providers: [...card.providers].toSorted(),
      pending: {
        cardFields: [...card.cardFields],
        newPrintings: card.newPrintings.size,
        faces: card.faces.size,
        printings: card.printings.size,
        newImages: card.newImages,
        failedImages: card.failedImages,
      },
      waitingSince: card.waitingSince,
    }))
    .toSorted(
      (a, b) =>
        Number(b.hasContribution) - Number(a.hasContribution) ||
        a.waitingSince.localeCompare(b.waitingSince) ||
        a.cardName.localeCompare(b.cardName),
    );
}
