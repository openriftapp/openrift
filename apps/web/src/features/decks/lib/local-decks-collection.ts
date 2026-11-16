// Logged-out deck storage. Decks built without an account live in
// `localStorage` under their own uuid, never on the server.

import type { DeckFormat } from "@openrift/shared/types/enums";
import { createCollection, localStorageCollectionOptions } from "@tanstack/react-db";
import { toast } from "sonner";
import { v7 as uuidv7 } from "uuid";

import type { LocalDeck, LocalDeckCard, LocalDeckPatch } from "@/features/decks/lib/local-deck";
import { m } from "@/paraglide/messages.js";

const LOCAL_DECKS_STORAGE_KEY = "openrift-local-decks-v2";

function isQuotaExceeded(error: unknown): boolean {
  // Browsers throw a DOMException named "QuotaExceededError" (legacy code 22,
  // or 1014 "NS_ERROR_DOM_QUOTA_REACHED" on Firefox).
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

export function writeLocalDecksItem(
  storage: Pick<Storage, "setItem">,
  name: string,
  value: string,
): boolean {
  try {
    storage.setItem(name, value);
    return true;
  } catch (error) {
    if (isQuotaExceeded(error)) {
      toast.error(m.decks_dialog_local_quota_full());
      return false;
    }
    throw error;
  }
}

// SSR has no localStorage; every access degrades to a no-op there.
const quotaAwareStorage = {
  getItem: (name: string) =>
    typeof localStorage === "undefined" ? null : localStorage.getItem(name),
  setItem: (name: string, value: string) => {
    if (typeof localStorage === "undefined") {
      return;
    }
    if (!writeLocalDecksItem(localStorage, name, value)) {
      throw new DOMException("Local deck storage is full", "QuotaExceededError");
    }
  },
  removeItem: (name: string) => {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(name);
    }
  },
};

function nowIso(): string {
  return new Date().toISOString();
}

// A write on a collection that never read storage overwrites it with that one row.
const localDecks = createCollection(
  localStorageCollectionOptions<LocalDeck>({
    id: "local-decks",
    storageKey: LOCAL_DECKS_STORAGE_KEY,
    storage: quotaAwareStorage,
    getKey: (deck) => deck.id,
    startSync: true,
  }),
);

export function getLocalDecksCollection() {
  return localDecks;
}

async function ignoreWriteFailure(write: {
  when: (state: "settled") => Promise<unknown>;
}): Promise<void> {
  try {
    await write.when("settled");
  } catch {
    // The storage wrapper has already shown the quota toast.
  }
}

/** Route loaders await this before rendering anything that branches on a deck being local. */
export async function preloadLocalDecks(): Promise<void> {
  await localDecks.preload();
}

export function isLocalDeck(deckId: string): boolean {
  return localDecks.has(deckId);
}

export function createLocalDeck(format: DeckFormat, name?: string): string {
  const id = uuidv7();
  const stamp = nowIso();
  const write = localDecks.insert({
    id,
    name: name?.trim() || m.decks_dialog_local_new_deck_name(),
    description: "",
    format,
    formatConfig: null,
    cards: [],
    coverCardId: null,
    coverFaceId: null,
    coverPosition: null,
    links: [],
    createdAt: stamp,
    updatedAt: stamp,
  });
  void ignoreWriteFailure(write);
  return id;
}

export function updateLocalDeck(id: string, patch: LocalDeckPatch): void {
  if (!localDecks.has(id)) {
    return;
  }
  const write = localDecks.update(id, (draft) => {
    // Only apply keys the caller set (an explicit `undefined` must not wipe a
    // field); a null description clears it to "".
    if (patch.name !== undefined) {
      draft.name = patch.name;
    }
    if (patch.description !== undefined) {
      draft.description = patch.description ?? "";
    }
    if (patch.format !== undefined) {
      draft.format = patch.format;
    }
    if (patch.formatConfig !== undefined) {
      draft.formatConfig = patch.formatConfig;
    }
    if (patch.coverCardId !== undefined) {
      draft.coverCardId = patch.coverCardId;
    }
    if (patch.coverFaceId !== undefined) {
      draft.coverFaceId = patch.coverFaceId;
    }
    if (patch.coverPosition !== undefined) {
      draft.coverPosition = patch.coverPosition;
    }
    if (patch.links !== undefined) {
      draft.links = patch.links;
    }
    draft.updatedAt = nowIso();
  });
  void ignoreWriteFailure(write);
}

export function setLocalDeckCards(id: string, cards: LocalDeckCard[]): void {
  if (!localDecks.has(id)) {
    return;
  }
  const write = localDecks.update(id, (draft) => {
    draft.cards = cards;
    draft.updatedAt = nowIso();
  });
  void ignoreWriteFailure(write);
}

export function deleteLocalDeck(id: string): void {
  if (!localDecks.has(id)) {
    return;
  }
  void ignoreWriteFailure(localDecks.delete(id));
}

export function duplicateLocalDeck(id: string): string | null {
  const source = localDecks.get(id);
  if (!source) {
    return null;
  }
  const newId = uuidv7();
  const stamp = nowIso();
  const write = localDecks.insert({
    ...source,
    id: newId,
    name: m.decks_dialog_local_copy_name({ name: source.name }),
    cards: source.cards.map((card) => ({ ...card })),
    createdAt: stamp,
    updatedAt: stamp,
  });
  void ignoreWriteFailure(write);
  return newId;
}

export function clearImportedLocalDecks(ids: string[]): void {
  const present = ids.filter((id) => localDecks.has(id));
  if (present.length > 0) {
    void ignoreWriteFailure(localDecks.delete(present));
  }
}
