import type { Printing } from "@openrift/shared/types/catalog";
import { createContext, useContext, useState } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand";
import { createStore } from "zustand/vanilla";

import type { VariantPopoverIntent } from "@/features/collections/stores/add-mode-store";
import type { RuleDropTarget } from "@/features/rules/lib/rule-drop";

export interface CardRowClickModifiers {
  shift?: boolean;
  ctrl?: boolean;
}

/** "copyDetails" opens the per-copy metadata dialog; "lend" opens the lend-to-a-friend dialog. */
export type CollectionContextAction = "move" | "addToList" | "lend" | "dispose" | "copyDetails";

/** "takeOff" opens a kept-vs-sold/traded chooser. */
export type ListBulkAction = "move" | "copy" | "remove" | "takeOff";

export type CardRowSurface = "catalog" | "collection" | "deck" | "list";

/** Handlers every card-browser surface can offer. */
interface BaseRowHandlers {
  /** `itemId` identifies the clicked row, for when one printing spans several rows. */
  onRowClick?: (printing: Printing, itemId?: string) => void;
  onSiblingClick?: (printing: Printing) => void;
  /** `quantity` is set only by the grid's digit-key shortcut; every other path means one. */
  onIncrement?: (printing: Printing, modifiers?: CardRowClickModifiers, quantity?: number) => void;
  onDecrement?: (
    printing: Printing,
    anchorEl?: HTMLElement,
    modifiers?: CardRowClickModifiers,
  ) => void;
  onOpenVariants?: (
    printing: Printing,
    anchorEl: HTMLElement,
    intent: VariantPopoverIntent,
  ) => void;
  /** Resolves mode-specific behavior: browse → open detail, select → toggle/shift-range. */
  onItemClick?: (itemId: string, printing: Printing, modifiers: CardRowClickModifiers) => void;
  /** Toggle the cell's stack in select mode (used by the cell's checkbox). */
  onItemToggle?: (itemId: string) => void;
  onAddToWishlist?: (printing: Printing) => void;
}

/** Handlers only /collections registers. */
interface CollectionRowHandlers {
  /**
   * The grid resolves the target (multi-selection, or just this card) before opening the dialog;
   * `printing` is the cell's *displayed* printing (sibling swaps included).
   */
  onContextAction?: (itemId: string, action: CollectionContextAction, printing?: Printing) => void;
  /** Claim `count` copies from the shared group collection; wired up only when group-owned. */
  onTake?: (itemId: string, count: number, printing?: Printing) => void;
}

/** Handlers only /lists registers. */
interface ListRowHandlers {
  /** Step an entry's own quantity by `delta` (browse-mode +/- buttons on the quantity strip). */
  onEntryQuantityStep?: (entryId: string, delta: number) => void;
  /** Remove an entry directly (the minus button at quantity 1, no confirm). */
  onRemoveEntry?: (entryId: string, cardName: string) => void;
  /** Open the trade-preference editor; the browser widens it to the selection. */
  onSetPreference?: (selectionId: string) => void;
  /** Is the given entry currently waiting on a pending quantity mutation? */
  isQuantityPendingFor?: (entryId: string) => boolean;
  /** The browser resolves the target (multi-selection, or just this entry) before opening the dialog. */
  onListBulkAction?: (selectionId: string, action: ListBulkAction) => void;
  /** Keyed by copy id, not entry id, so rule-produced entries (no `list_entries` row) can be moved too. */
  onMoveCopyToCollection?: (copyId: string) => void;
  onAddEntryToCollection?: (selectionId: string) => void;
  /** Rule-produced entries have no `list_entries` row, so this excludes or keeps them instead. */
  onDropFromRule?: (target: RuleDropTarget) => void;
}

/** Keyed by surface, so a surface can't register another surface's vocabulary by accident. */
export interface HandlersBySurface {
  catalog: BaseRowHandlers;
  collection: BaseRowHandlers & CollectionRowHandlers;
  deck: BaseRowHandlers;
  list: BaseRowHandlers & ListRowHandlers;
}

type CardRowHandlers = BaseRowHandlers & CollectionRowHandlers & ListRowHandlers;

function createDispatch(handlers: () => CardRowHandlers) {
  return {
    dispatchRowClick: (printing: Printing) => handlers().onRowClick?.(printing),
    dispatchTableRowClick: (printing: Printing, itemId: string) =>
      handlers().onRowClick?.(printing, itemId),
    dispatchSiblingClick: (printing: Printing) => handlers().onSiblingClick?.(printing),
    dispatchIncrement: (printing: Printing, modifiers?: CardRowClickModifiers) =>
      handlers().onIncrement?.(printing, modifiers),
    dispatchDecrement: (
      printing: Printing,
      anchorEl: HTMLElement,
      modifiers?: CardRowClickModifiers,
    ) => handlers().onDecrement?.(printing, anchorEl, modifiers),
    dispatchAddToWishlist: (printing: Printing) => handlers().onAddToWishlist?.(printing),
    dispatchOpenVariants: (
      printing: Printing,
      anchorEl: HTMLElement,
      intent: VariantPopoverIntent,
    ) => handlers().onOpenVariants?.(printing, anchorEl, intent),
    dispatchItemClick: (itemId: string, printing: Printing, modifiers: CardRowClickModifiers) =>
      handlers().onItemClick?.(itemId, printing, modifiers),
    dispatchItemToggle: (itemId: string) => handlers().onItemToggle?.(itemId),
    dispatchContextAction: (itemId: string, action: CollectionContextAction, printing?: Printing) =>
      handlers().onContextAction?.(itemId, action, printing),
    dispatchTake: (itemId: string, count: number, printing?: Printing) =>
      handlers().onTake?.(itemId, count, printing),
    dispatchEntryQuantityStep: (entryId: string, delta: number) =>
      handlers().onEntryQuantityStep?.(entryId, delta),
    dispatchRemoveEntry: (entryId: string, cardName: string) =>
      handlers().onRemoveEntry?.(entryId, cardName),
    dispatchSetPreference: (entryId: string) => handlers().onSetPreference?.(entryId),
    dispatchListBulkAction: (selectionId: string, action: ListBulkAction) =>
      handlers().onListBulkAction?.(selectionId, action),
    dispatchMoveCopyToCollection: (copyId: string) => handlers().onMoveCopyToCollection?.(copyId),
    dispatchAddEntryToCollection: (selectionId: string) =>
      handlers().onAddEntryToCollection?.(selectionId),
    dispatchDropFromRule: (target: RuleDropTarget) => handlers().onDropFromRule?.(target),
  };
}

/**
 * Trampolines with permanent identity, so passing them to memoized cells never bails the
 * memo on a fresh closure. Each one calls the handler the surface registered last.
 */
export type CardRowDispatch = ReturnType<typeof createDispatch>;

interface CardRowActionsState {
  handlers: CardRowHandlers;
  dispatch: CardRowDispatch;
  setHandlers: (handlers: CardRowHandlers) => void;
}

export type CardRowActionsStore = StoreApi<CardRowActionsState>;

/** A store owned by one surface; the type-only brand pins which handlers it accepts. */
export type SurfaceRowActionsStore<TSurface extends CardRowSurface> = CardRowActionsStore & {
  readonly surface?: TSurface;
};

/** One per card surface: the handlers its grid or table cells dispatch to. */
export function createCardRowActionsStore(): CardRowActionsStore {
  return createStore<CardRowActionsState>()((set, get) => ({
    handlers: {},
    dispatch: createDispatch(() => get().handlers),
    setHandlers: (handlers) => set({ handlers }),
  }));
}

/** Creates the calling surface's store once and keeps it for the surface's lifetime. */
export function useOwnCardRowActionsStore<
  TSurface extends CardRowSurface = CardRowSurface,
>(): SurfaceRowActionsStore<TSurface> {
  // oxlint-disable-next-line react/hook-use-state -- a stable per-surface store, never replaced
  const [store] = useState(createCardRowActionsStore);
  return store;
}

export const CardRowActionsStoreContext = createContext<CardRowActionsStore | null>(null);

export function useCardRowActionsStoreApi(): CardRowActionsStore {
  const store = useContext(CardRowActionsStoreContext);
  if (store === null) {
    throw new Error("card row actions need a CardRowActionsStoreContext");
  }
  return store;
}

function useCardRowActionsStore<T>(selector: (state: CardRowActionsState) => T): T {
  return useStore(useCardRowActionsStoreApi(), selector);
}

export function useCardRowDispatch(): CardRowDispatch {
  return useCardRowActionsStore((state) => state.dispatch);
}

export function useQuantityPending(entryId: string | null): boolean {
  return useCardRowActionsStore(
    (state) => entryId !== null && (state.handlers.isQuantityPendingFor?.(entryId) ?? false),
  );
}
