import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useGridSelectionStore } from "@/features/cards/stores/grid-selection-store";

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

afterEach(() => {
  useGridSelectionStore.getState().resetSelection();
  document.body.innerHTML = "";
});

describe("useSelectAllHotkey", () => {
  it("enters manage mode with every id selected", () => {
    renderHook(() => useSelectAllHotkey(["a", "b"], true));

    const event = pressSelectAll();

    expect(event.defaultPrevented).toBe(true);
    const state = useGridSelectionStore.getState();
    expect(state.selectMode).toBe(true);
    expect([...state.selected].toSorted()).toEqual(["a", "b"]);
  });

  it("does nothing when disabled", () => {
    renderHook(() => useSelectAllHotkey(["a"], false));

    pressSelectAll();

    expect(useGridSelectionStore.getState().selectMode).toBe(false);
  });

  it("does nothing when there is nothing to select", () => {
    renderHook(() => useSelectAllHotkey([], true));

    pressSelectAll();

    expect(useGridSelectionStore.getState().selectMode).toBe(false);
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
      renderHook(() => useSelectAllHotkey(["a"], true));

      const event = pressSelectAll(field);

      expect(event.defaultPrevented).toBe(false);
      expect(useGridSelectionStore.getState().selectMode).toBe(false);
    },
  );

  it("leaves Ctrl+A in a text field to the field", () => {
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    renderHook(() => useSelectAllHotkey(["a"], true));

    pressSelectAll(input);

    expect(useGridSelectionStore.getState().selectMode).toBe(false);
  });
});
