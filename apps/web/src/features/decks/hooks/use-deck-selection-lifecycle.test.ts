import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DeckSelectionStore } from "@/features/decks/stores/deck-selection-store";
import { createDeckSelectionStore } from "@/features/decks/stores/deck-selection-store";

import { useDeckSelectionLifecycle } from "./use-deck-selection-lifecycle";

let store: DeckSelectionStore;

beforeEach(() => {
  store = createDeckSelectionStore();
  store.getState().setSelectMode(true);
  store.getState().toggleSelect("deck-1");
});

afterEach(() => {
  document.body.innerHTML = "";
});

function pressEscape(target: Element = document.body, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
    ...options,
  });
  target.dispatchEvent(event);
  return event;
}

function isSelecting() {
  const { selectMode, selected } = store.getState();
  return selectMode || selected.size > 0;
}

describe("useDeckSelectionLifecycle", () => {
  it("leaves select mode and clears the selection on Escape", () => {
    renderHook(() => useDeckSelectionLifecycle(store));

    pressEscape();

    expect(isSelecting()).toBe(false);
  });

  it("marks the Escape it takes as handled, so a docked detail pane stays open", () => {
    let paneSawUnhandled = false;
    const pane = (event: KeyboardEvent) => {
      paneSawUnhandled = !event.defaultPrevented;
    };
    globalThis.addEventListener("keydown", pane);
    renderHook(() => useDeckSelectionLifecycle(store));

    const event = pressEscape();

    globalThis.removeEventListener("keydown", pane);
    expect(event.defaultPrevented).toBe(true);
    expect(paneSawUnhandled).toBe(false);
  });

  it("leaves an Escape it does not take unhandled", () => {
    renderHook(() => useDeckSelectionLifecycle(store));
    const input = document.createElement("input");
    document.body.append(input);

    expect(pressEscape(input).defaultPrevented).toBe(false);
  });

  it("ignores keys other than Escape", () => {
    renderHook(() => useDeckSelectionLifecycle(store));

    pressEscape(document.body, { key: "Enter" });

    expect(isSelecting()).toBe(true);
  });

  it("leaves Escape to an open dialog", () => {
    renderHook(() => useDeckSelectionLifecycle(store));
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const button = document.createElement("button");
    dialog.append(button);
    document.body.append(dialog);

    pressEscape(button);

    expect(isSelecting()).toBe(true);
  });

  it("leaves Escape to a text field", () => {
    renderHook(() => useDeckSelectionLifecycle(store));
    const input = document.createElement("input");
    document.body.append(input);

    pressEscape(input);

    expect(isSelecting()).toBe(true);
  });

  it("ignores an Escape another handler already consumed", () => {
    renderHook(() => useDeckSelectionLifecycle(store));
    const consume = (event: Event) => event.preventDefault();
    document.body.addEventListener("keydown", consume);

    pressEscape();

    document.body.removeEventListener("keydown", consume);
    expect(isSelecting()).toBe(true);
  });

  it("does nothing on Escape outside select mode", () => {
    store.getState().setSelectMode(false);
    renderHook(() => useDeckSelectionLifecycle(store));

    pressEscape();

    expect(store.getState().selected.size).toBe(1);
  });

  it("drops the selection when the page unmounts", () => {
    const { unmount } = renderHook(() => useDeckSelectionLifecycle(store));

    unmount();

    expect(isSelecting()).toBe(false);
  });

  it("resets only the store it was given", () => {
    const other = createDeckSelectionStore();
    other.getState().setSelectMode(true);
    renderHook(() => useDeckSelectionLifecycle(store));

    pressEscape();

    expect(isSelecting()).toBe(false);
    expect(other.getState().selectMode).toBe(true);
  });
});
