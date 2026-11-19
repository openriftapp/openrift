import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { GridSelectionStore } from "@/features/cards/stores/grid-selection-store";
import { createGridSelectionStore } from "@/features/cards/stores/grid-selection-store";
import { layoutStoresWrapper } from "@/test/collection-layout-stores";

import { useSelectAllHotkey } from "./use-select-all-hotkey";

function pressSelectAll(target: EventTarget = document): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key: "a",
    code: "KeyA",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

let selection: GridSelectionStore;
let wrapper: ReturnType<typeof layoutStoresWrapper>;

beforeEach(() => {
  selection = createGridSelectionStore();
  wrapper = layoutStoresWrapper({ gridSelection: selection });
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useSelectAllHotkey", () => {
  it("enters manage mode with every id selected", () => {
    renderHook(() => useSelectAllHotkey(["a", "b"], true), { wrapper });

    const event = pressSelectAll();

    expect(event.defaultPrevented).toBe(true);
    const state = selection.getState();
    expect(state.selectMode).toBe(true);
    expect([...state.selected].toSorted()).toEqual(["a", "b"]);
  });

  it("does nothing when disabled", () => {
    renderHook(() => useSelectAllHotkey(["a"], false), { wrapper });

    pressSelectAll();

    expect(selection.getState().selectMode).toBe(false);
  });

  it("does nothing when there is nothing to select", () => {
    renderHook(() => useSelectAllHotkey([], true), { wrapper });

    pressSelectAll();

    expect(selection.getState().selectMode).toBe(false);
  });

  it.each(["dialog", "alertdialog", "menu", "listbox"])(
    "leaves Ctrl+A to the browser while focus is inside an open %s",
    (role) => {
      const overlay = document.createElement("div");
      overlay.setAttribute("role", role);
      const field = document.createElement("textarea");
      field.readOnly = true;
      overlay.append(field);
      document.body.append(overlay);
      field.focus();
      renderHook(() => useSelectAllHotkey(["a"], true), { wrapper });

      const event = pressSelectAll(field);

      expect(event.defaultPrevented).toBe(false);
      expect(selection.getState().selectMode).toBe(false);
    },
  );

  it("leaves Ctrl+A in a text field to the field", () => {
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    renderHook(() => useSelectAllHotkey(["a"], true), { wrapper });

    pressSelectAll(input);

    expect(selection.getState().selectMode).toBe(false);
  });

  it("selects into each enclosing layout's own store", () => {
    const other = createGridSelectionStore();
    renderHook(() => useSelectAllHotkey(["a"], true), { wrapper });
    renderHook(() => useSelectAllHotkey(["b"], true), {
      wrapper: layoutStoresWrapper({ gridSelection: other }),
    });

    pressSelectAll();

    expect([...selection.getState().selected]).toEqual(["a"]);
    expect([...other.getState().selected]).toEqual(["b"]);
  });
});
