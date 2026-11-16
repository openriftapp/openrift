import { deckCardKey } from "@openrift/shared/deck-cards";
import { toError } from "@openrift/shared/strings";
import type { Collection } from "@tanstack/react-db";
import { createCollection, localOnlyCollectionOptions } from "@tanstack/react-db";
import type { QueryClient } from "@tanstack/react-query";

import { cleanupWhenIdle, markOrphaned } from "@/features/collections/lib/collection-cleanup";
import { loadCollection } from "@/features/collections/lib/collection-load";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { isUnknownDeckCard } from "@/features/decks/lib/deck-builder-card";
import type { PlanDraft } from "@/features/decks/lib/deck-plan";
import { getDeckCardsCollection } from "@/features/decks/lib/decks-collection";
import { saveDeckCards } from "@/features/decks/lib/decks-write";
import { isLocalDeck, setLocalDeckCards } from "@/features/decks/lib/local-decks-collection";
import { useDeckUndoStore } from "@/features/decks/stores/deck-undo-store";
import { mutationTag } from "@/lib/mutation-metadata";
import { withTimeout } from "@/lib/with-timeout";
import { m } from "@/paraglide/messages.js";

export const LOCAL_SCOPE = "local";

const SAVE_DEBOUNCE_MS = 1000;

export interface DeckSaveStatus {
  isSaving: boolean;
  isDirty: boolean;
  error: Error | null;
}

export const CLEAN_STATUS: DeckSaveStatus = { isSaving: false, isDirty: false, error: null };

interface ServerCards {
  cards: DeckBuilderCard[];
  signature: string;
}

export type DeckDraftConflictChoice = "keep" | "load";

interface DraftEntry {
  deckId: string;
  collection: Collection<DeckBuilderCard, string | number>;
  status: DeckSaveStatus;
  subscribers: Set<() => void>;
  saveTimer: ReturnType<typeof setTimeout> | null;
  saveController: AbortController | null;
  saveSeq: number;
  lastAppliedSeq: number;
  hydrated: boolean;
  planDraft: PlanDraft | null;
  base: string | null;
  sent: string[];
  server: ServerCards | null;
  conflict: ServerCards | null;
}

interface CacheEntry {
  userId: string;
  drafts: Map<string, DraftEntry>;
}

const cache = new WeakMap<QueryClient, CacheEntry>();

const rebaseWrites = mutationTag<true>();

function cardsSignature(
  cards: readonly {
    cardId: string;
    zone: string;
    quantity: number;
    preferredPrintingId: string | null;
  }[],
): string {
  return cards
    .map((card) => `${deckCardKey(card)}*${card.quantity}`)
    .toSorted()
    .join("\n");
}

function notify(entry: DraftEntry): void {
  for (const listener of entry.subscribers) {
    listener();
  }
}

function setStatus(entry: DraftEntry, partial: Partial<DeckSaveStatus>): void {
  const next = { ...entry.status, ...partial };
  if (
    next.isSaving === entry.status.isSaving &&
    next.isDirty === entry.status.isDirty &&
    next.error === entry.status.error
  ) {
    return;
  }
  entry.status = next;
  notify(entry);
}

function collectionCards(entry: DraftEntry): {
  cardId: string;
  zone: DeckBuilderCard["zone"];
  quantity: number;
  preferredPrintingId: string | null;
}[] {
  return [...entry.collection.values()].map((card) => ({
    cardId: card.cardId,
    zone: card.zone,
    quantity: card.quantity,
    preferredPrintingId: card.preferredPrintingId,
  }));
}

function runLocalSave(entry: DraftEntry): void {
  setLocalDeckCards(entry.deckId, collectionCards(entry));
  setStatus(entry, { isSaving: false, isDirty: entry.saveTimer !== null, error: null });
}

async function runSave(queryClient: QueryClient, userId: string, entry: DraftEntry): Promise<void> {
  if (isLocalDeck(entry.deckId)) {
    runLocalSave(entry);
    return;
  }

  if (entry.conflict) {
    setStatus(entry, { isDirty: true });
    return;
  }

  entry.saveController?.abort();
  const controller = new AbortController();
  entry.saveController = controller;
  const seq = ++entry.saveSeq;

  const cards = collectionCards(entry);
  const signature = cardsSignature(cards);
  entry.sent.push(signature);

  setStatus(entry, { isSaving: true, error: null });

  try {
    const collection = getDeckCardsCollection(queryClient, userId);
    await loadCollection(collection);
    await withTimeout(
      saveDeckCards(collection, entry.deckId, cards, { queryClient, userId }).when("settled"),
      { label: m.decks_editor_timeout_save(), abortController: controller },
    );

    if (seq < entry.lastAppliedSeq || controller.signal.aborted) {
      return;
    }
    entry.lastAppliedSeq = seq;
    entry.base = signature;
    entry.sent = entry.sent.slice(entry.sent.indexOf(signature) + 1);

    const stillDirty = entry.saveTimer !== null;
    setStatus(entry, { isSaving: false, isDirty: stillDirty, error: null });
  } catch (error) {
    if (controller.signal.aborted && seq < entry.saveSeq) {
      return;
    }
    setStatus(entry, {
      isSaving: false,
      error: toError(error),
    });
  }
  reconcile(entry);
}

function scheduleSave(queryClient: QueryClient, userId: string, entry: DraftEntry): void {
  setStatus(entry, { isDirty: true, error: null });
  if (entry.saveTimer) {
    clearTimeout(entry.saveTimer);
  }
  entry.saveTimer = setTimeout(() => {
    entry.saveTimer = null;
    void runSave(queryClient, userId, entry);
  }, SAVE_DEBOUNCE_MS);
}

function createEntry(queryClient: QueryClient, userId: string, deckId: string): DraftEntry {
  const entry: DraftEntry = {
    deckId,
    collection: null as unknown as Collection<DeckBuilderCard, string | number>,
    status: CLEAN_STATUS,
    subscribers: new Set(),
    saveTimer: null,
    saveController: null,
    saveSeq: 0,
    lastAppliedSeq: 0,
    hydrated: false,
    planDraft: null,
    base: null,
    sent: [],
    server: null,
    conflict: null,
  };

  const onWrite = ({
    transaction,
  }: {
    transaction: { mutations: readonly { metadata: unknown }[] };
  }): Promise<void> => {
    if (!transaction.mutations.every((mutation) => rebaseWrites.read(mutation.metadata))) {
      scheduleSave(queryClient, userId, entry);
    }
    return Promise.resolve();
  };

  entry.collection = createCollection(
    localOnlyCollectionOptions<DeckBuilderCard>({
      id: `deck-draft:${userId}:${deckId}`,
      getKey: deckCardKey,
      onInsert: onWrite,
      onUpdate: onWrite,
      onDelete: onWrite,
    }),
  );

  return entry;
}

function getDraftsForUser(queryClient: QueryClient, userId: string): Map<string, DraftEntry> {
  const existing = cache.get(queryClient);
  if (existing && existing.userId === userId) {
    return existing.drafts;
  }
  if (existing) {
    // Local-only collections don't auto-GC (gcTime: 0); orphan and clean up
    // every previous-user draft here or they leak indefinitely.
    for (const [draftDeckId, draft] of existing.drafts) {
      if (draft.saveTimer) {
        clearTimeout(draft.saveTimer);
        draft.saveTimer = null;
      }
      draft.saveController?.abort();
      draft.saveController = null;
      markOrphaned(draft.collection, `deck-draft:${existing.userId}:${draftDeckId}`);
      cleanupWhenIdle(draft.collection);
    }
  }
  const entry: CacheEntry = { userId, drafts: new Map() };
  cache.set(queryClient, entry);
  return entry.drafts;
}

export function getDeckDraftCollection(
  queryClient: QueryClient,
  userId: string,
  deckId: string,
): Collection<DeckBuilderCard, string | number> {
  const drafts = getDraftsForUser(queryClient, userId);
  let entry = drafts.get(deckId);
  if (!entry) {
    entry = createEntry(queryClient, userId, deckId);
    drafts.set(deckId, entry);
  }
  return entry.collection;
}

function getOrCreateEntry(queryClient: QueryClient, userId: string, deckId: string): DraftEntry {
  const drafts = getDraftsForUser(queryClient, userId);
  let entry = drafts.get(deckId);
  if (!entry) {
    entry = createEntry(queryClient, userId, deckId);
    drafts.set(deckId, entry);
  }
  return entry;
}

function replaceDraftCards(
  entry: DraftEntry,
  cards: DeckBuilderCard[],
  metadata?: Record<string, unknown>,
): void {
  const existingKeys = new Set<string | number>();
  for (const key of entry.collection.keys()) {
    existingKeys.add(key);
  }
  const incomingKeys = new Set<string | number>(cards.map((card) => deckCardKey(card)));

  for (const key of existingKeys) {
    if (!incomingKeys.has(key)) {
      entry.collection.delete(key, { metadata });
    }
  }
  for (const card of cards) {
    const key = deckCardKey(card);
    if (existingKeys.has(key)) {
      entry.collection.update(key, { metadata }, (draft) => {
        Object.assign(draft, card);
      });
    } else {
      entry.collection.insert(card, { metadata });
    }
  }
}

function setConflict(entry: DraftEntry, conflict: ServerCards | null): void {
  if (entry.conflict === conflict) {
    return;
  }
  entry.conflict = conflict;
  notify(entry);
}

function rebase(entry: DraftEntry, cards: DeckBuilderCard[], signature: string): void {
  if (entry.saveTimer) {
    clearTimeout(entry.saveTimer);
    entry.saveTimer = null;
  }
  entry.saveController?.abort();
  entry.saveController = null;
  entry.base = signature;
  entry.sent = [];

  replaceDraftCards(entry, cards, rebaseWrites.tag(true));

  setStatus(entry, { isSaving: false, isDirty: false, error: null });
  setConflict(entry, null);

  if (!entry.hydrated) {
    entry.hydrated = true;
    notify(entry);
  }

  useDeckUndoStore.getState().reset(entry.deckId);
}

function refreshCardDetails(entry: DraftEntry, cards: readonly DeckBuilderCard[]): void {
  for (const card of cards) {
    const key = deckCardKey(card);
    const row = entry.collection.get(key);
    if (row && isUnknownDeckCard(row) && !isUnknownDeckCard(card)) {
      entry.collection.update(key, { metadata: rebaseWrites.tag(true) }, (draft) => {
        Object.assign(draft, { ...card, quantity: draft.quantity });
      });
    }
  }
}

function reconcile(entry: DraftEntry): void {
  const server = entry.server;
  if (!server || !entry.hydrated) {
    return;
  }
  if (server.signature === entry.base || entry.sent.includes(server.signature)) {
    setConflict(entry, null);
    return;
  }
  if (server.signature === cardsSignature(collectionCards(entry))) {
    entry.base = server.signature;
    setConflict(entry, null);
    return;
  }
  // The replace in flight decides the stored list; it reconciles again when it settles.
  if (entry.status.isSaving) {
    return;
  }
  if (!entry.status.isDirty && entry.saveTimer === null) {
    rebase(entry, server.cards, server.signature);
    return;
  }
  if (entry.conflict?.signature !== server.signature) {
    setConflict(entry, server);
  }
}

export function hydrateDeckDraft(
  queryClient: QueryClient,
  userId: string,
  deckId: string,
  cards: DeckBuilderCard[],
): void {
  rebase(getOrCreateEntry(queryClient, userId, deckId), cards, cardsSignature(cards));
}

/**
 * Brings the draft in line with the deck's stored cards: a clean draft follows them,
 * a draft with unsaved edits holds a conflict until `resolveDeckDraftConflict`.
 */
export function syncDeckDraft(
  queryClient: QueryClient,
  userId: string,
  deckId: string,
  cards: DeckBuilderCard[],
): void {
  const entry = getOrCreateEntry(queryClient, userId, deckId);
  if (!entry.hydrated) {
    hydrateDeckDraft(queryClient, userId, deckId, cards);
    return;
  }
  if (isLocalDeck(deckId)) {
    return;
  }
  entry.server = { cards, signature: cardsSignature(cards) };
  reconcile(entry);
  refreshCardDetails(entry, cards);
}

export function resolveDeckDraftConflict(
  queryClient: QueryClient,
  userId: string,
  deckId: string,
  choice: DeckDraftConflictChoice,
): void {
  const cached = cache.get(queryClient);
  const entry = cached?.userId === userId ? cached.drafts.get(deckId) : undefined;
  const conflict = entry?.conflict;
  if (!entry || !conflict) {
    return;
  }
  if (choice === "load") {
    rebase(entry, conflict.cards, conflict.signature);
    return;
  }
  entry.base = conflict.signature;
  setConflict(entry, null);
  if (entry.status.isDirty && entry.saveTimer === null) {
    void runSave(queryClient, userId, entry);
  }
}

export function getDeckDraftHasConflict(
  queryClient: QueryClient,
  userId: string,
  deckId: string,
): boolean {
  const cached = cache.get(queryClient);
  if (!cached || cached.userId !== userId) {
    return false;
  }
  return Boolean(cached.drafts.get(deckId)?.conflict);
}

/**
 * For writes that bypass the editor: drops pending draft saves and marks the
 * draft stale so the editor re-hydrates from the deck detail.
 */
export function resetDeckDraft(queryClient: QueryClient, scope: string, deckId: string): void {
  const cached = cache.get(queryClient);
  const entry = cached?.userId === scope ? cached.drafts.get(deckId) : undefined;
  if (!entry) {
    return;
  }

  if (entry.saveTimer) {
    clearTimeout(entry.saveTimer);
    entry.saveTimer = null;
  }
  entry.saveController?.abort();
  entry.saveController = null;
  entry.saveSeq += 1;
  entry.status = CLEAN_STATUS;
  entry.hydrated = false;
  entry.base = null;
  entry.sent = [];
  entry.server = null;
  entry.conflict = null;
  notify(entry);
}

export function flushDeckDraft(queryClient: QueryClient, scope: string, deckId: string): void {
  const cached = cache.get(queryClient);
  const entry = cached?.userId === scope ? cached.drafts.get(deckId) : undefined;
  if (!entry?.saveTimer) {
    return;
  }
  clearTimeout(entry.saveTimer);
  entry.saveTimer = null;
  void runSave(queryClient, scope, entry);
}

export function getDeckPlanDraft(
  queryClient: QueryClient,
  userId: string,
  deckId: string,
): PlanDraft | null {
  const cached = cache.get(queryClient);
  if (!cached || cached.userId !== userId) {
    return null;
  }
  return cached.drafts.get(deckId)?.planDraft ?? null;
}

/** Holds an unsaved plan while the plan tab is closed; `null` drops it. */
export function setDeckPlanDraft(
  queryClient: QueryClient,
  userId: string,
  deckId: string,
  draft: PlanDraft | null,
): void {
  if (draft === null) {
    const cached = cache.get(queryClient);
    const entry = cached?.userId === userId ? cached.drafts.get(deckId) : undefined;
    if (entry) {
      entry.planDraft = null;
    }
    return;
  }
  getOrCreateEntry(queryClient, userId, deckId).planDraft = draft;
}

export function applyDeckSnapshot(
  queryClient: QueryClient,
  userId: string,
  deckId: string,
  cards: DeckBuilderCard[],
): void {
  replaceDraftCards(getOrCreateEntry(queryClient, userId, deckId), cards);
}

export function subscribeToDeckDraft(
  queryClient: QueryClient,
  userId: string,
  deckId: string,
  listener: () => void,
): () => void {
  const entry = getOrCreateEntry(queryClient, userId, deckId);
  entry.subscribers.add(listener);
  return () => entry.subscribers.delete(listener);
}

export function getDeckDraftHydrated(
  queryClient: QueryClient,
  userId: string,
  deckId: string,
): boolean {
  const cached = cache.get(queryClient);
  if (!cached || cached.userId !== userId) {
    return false;
  }
  return cached.drafts.get(deckId)?.hydrated ?? false;
}

export function getDeckDraftStatus(
  queryClient: QueryClient,
  userId: string,
  deckId: string,
): DeckSaveStatus {
  const cached = cache.get(queryClient);
  if (!cached || cached.userId !== userId) {
    return CLEAN_STATUS;
  }
  return cached.drafts.get(deckId)?.status ?? CLEAN_STATUS;
}
