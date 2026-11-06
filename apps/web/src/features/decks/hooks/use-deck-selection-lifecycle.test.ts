import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useDeckSelectionStore } from "@/features/decks/stores/deck-selection-store";
import { createStoreResetter } from "@/test/store-helpers";

import { useDeckSelectionLifecycle } from "./use-deck-selection-lifecycle";

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(useDeckSelectionStore);
  useDeckSelectionStore.getState().setSelectMode(true);
  useDeckSelectionStore.getState().toggleSelect("deck-1");
});

afterEach(() => {
  resetStore();
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
}

function isSelecting() {
  const { selectMode, selected } = useDeckSelectionStore.getState();
  return selectMode || selected.size > 0;
}

describe("useDeckSelectionLifecycle", () => {
  it("leaves select mode and clears the selection on Escape", () => {
    renderHook(() => useDeckSelectionLifecycle());

    pressEscape();

    expect(isSelecting()).toBe(false);
  });

  it("ignores keys other than Escape", () => {
    renderHook(() => useDeckSelectionLifecycle());

    pressEscape(document.body, { key: "Enter" });

    expect(isSelecting()).toBe(true);
  });

  it("leaves Escape to an open dialog", () => {
    renderHook(() => useDeckSelectionLifecycle());
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const button = document.createElement("button");
    dialog.append(button);
    document.body.append(dialog);

    pressEscape(button);

    expect(isSelecting()).toBe(true);
  });

  it("leaves Escape to a text field", () => {
    renderHook(() => useDeckSelectionLifecycle());
    const input = document.createElement("input");
    document.body.append(input);

    pressEscape(input);

    expect(isSelecting()).toBe(true);
  });

  it("ignores an Escape another handler already consumed", () => {
    renderHook(() => useDeckSelectionLifecycle());
    const consume = (event: Event) => event.preventDefault();
    document.body.addEventListener("keydown", consume);

    pressEscape();

    document.body.removeEventListener("keydown", consume);
    expect(isSelecting()).toBe(true);
  });

  it("does nothing on Escape outside select mode", () => {
    useDeckSelectionStore.getState().setSelectMode(false);
    renderHook(() => useDeckSelectionLifecycle());

    pressEscape();

    expect(useDeckSelectionStore.getState().selected.size).toBe(1);
  });

  it("drops the selection when the page unmounts", () => {
    const { unmount } = renderHook(() => useDeckSelectionLifecycle());

    unmount();

    expect(isSelecting()).toBe(false);
  });
});
