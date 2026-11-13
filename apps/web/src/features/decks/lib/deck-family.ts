/**
 * A family is a set of decks sharing a `familyId`; the list shows one entry
 * per family, fronted by the primary variant, with the rest revealed on demand.
 */
interface DeckFamilyItem {
  deck: {
    id: string;
    name: string;
    familyId: string | null;
    collectionId: string | null;
    isPrimary: boolean;
    updatedAt: string;
  };
  familyName: string | null;
}

export interface StoredDeck {
  deckId: string;
  deckName: string;
  collectionId: string;
}

export interface DeckFamilyEntry {
  id: string;
  name: string | null;
  updatedAt: string;
  memberCount: number;
  stored: readonly StoredDeck[];
  expanded: boolean;
  role: "front" | "member";
}

/** Members carry the same `familyName`, but a row written before a refetch can still hold null. */
export function familyNameOf(
  members: readonly Pick<DeckFamilyItem, "familyName">[],
): string | null {
  return members.find((member) => member.familyName !== null)?.familyName ?? null;
}

export function familyUpdatedAt(
  members: readonly { deck: { updatedAt: string } }[],
): string | undefined {
  let newest: string | undefined;
  for (const member of members) {
    if (newest === undefined || member.deck.updatedAt > newest) {
      newest = member.deck.updatedAt;
    }
  }
  return newest;
}

export interface CollapsedDeckEntry<T> {
  item: T;
  family?: DeckFamilyEntry;
}

export function familyFrontView<T extends { deck: { name: string; updatedAt: string } }>(
  item: T,
  family?: DeckFamilyEntry,
): { title: string; isNamedGroup: boolean; metaItem: T } {
  if (family?.role !== "front") {
    return { title: item.deck.name, isNamedGroup: false, metaItem: item };
  }
  const metaItem =
    family.updatedAt === item.deck.updatedAt
      ? item
      : { ...item, deck: { ...item.deck, updatedAt: family.updatedAt } };
  return {
    title: family.name ?? item.deck.name,
    isNamedGroup: family.name !== null,
    metaItem,
  };
}

export function storedDecksShown(
  deck: { id: string; name: string; collectionId: string | null },
  family?: DeckFamilyEntry,
): readonly StoredDeck[] {
  if (family?.role === "front" && !family.expanded) {
    return family.stored;
  }
  return deck.collectionId === null
    ? []
    : [{ deckId: deck.id, deckName: deck.name, collectionId: deck.collectionId }];
}

/** The front renders at its own sorted position, not the first member's. */
export function collapseFamilies<T extends DeckFamilyItem>(
  items: T[],
  expandedFamilies: ReadonlySet<string>,
): CollapsedDeckEntry<T>[] {
  const membersByFamily = new Map<string, T[]>();
  for (const item of items) {
    const familyId = item.deck.familyId;
    if (familyId === null) {
      continue;
    }
    const members = membersByFamily.get(familyId);
    if (members) {
      members.push(item);
    } else {
      membersByFamily.set(familyId, [item]);
    }
  }

  const frontIds = new Map<string, string>();
  for (const [familyId, members] of membersByFamily) {
    const primary = members.find((member) => member.deck.isPrimary);
    const front = primary ?? members[0];
    if (front) {
      frontIds.set(familyId, front.deck.id);
    }
  }

  const entries: CollapsedDeckEntry<T>[] = [];
  for (const item of items) {
    const familyId = item.deck.familyId;
    if (familyId === null) {
      entries.push({ item });
      continue;
    }
    const frontId = frontIds.get(familyId);
    if (frontId !== item.deck.id) {
      continue;
    }
    const members = membersByFamily.get(familyId) ?? [];
    const expanded = expandedFamilies.has(familyId);
    const family = {
      id: familyId,
      name: familyNameOf(members),
      updatedAt: familyUpdatedAt(members) ?? item.deck.updatedAt,
      memberCount: members.length,
      stored: members.flatMap(({ deck }) =>
        deck.collectionId === null
          ? []
          : [{ deckId: deck.id, deckName: deck.name, collectionId: deck.collectionId }],
      ),
      expanded,
    };
    entries.push({ item, family: { ...family, role: "front" } });
    if (!expanded) {
      continue;
    }
    for (const member of members) {
      if (member.deck.id !== frontId) {
        entries.push({ item: member, family: { ...family, role: "member" } });
      }
    }
  }
  return entries;
}

export type DeckGridEntry<T> =
  | { kind: "deck"; entry: CollapsedDeckEntry<T> }
  | { kind: "variants"; familyId: string; items: T[] };

/** Moves an expanded family's members into one panel entry right after its front; the panel lists the front too. */
export function withVariantPanels<T>(entries: CollapsedDeckEntry<T>[]): DeckGridEntry<T>[] {
  const result: DeckGridEntry<T>[] = [];
  let panel: { kind: "variants"; familyId: string; items: T[] } | undefined;
  for (const entry of entries) {
    const family = entry.family;
    if (family?.role === "member" && panel?.familyId === family.id) {
      panel.items.push(entry.item);
      continue;
    }
    result.push({ kind: "deck", entry });
    panel = undefined;
    if (family?.role === "front" && family.expanded && family.memberCount > 1) {
      panel = { kind: "variants", familyId: family.id, items: [entry.item] };
      result.push(panel);
    }
  }
  return result;
}
