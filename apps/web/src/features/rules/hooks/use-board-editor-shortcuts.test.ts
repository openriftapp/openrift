import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BoardEditorShortcutHandlers } from "./use-board-editor-shortcuts";
import { handleBoardEditorKey } from "./use-board-editor-shortcuts";

let handlers: BoardEditorShortcutHandlers;

beforeEach(() => {
  handlers = {
    hasSelection: true,
    onExhaust: vi.fn(),
    onKeyword: vi.fn(),
    onDamage: vi.fn(),
    onMight: vi.fn(),
    onArrow: vi.fn(),
    onRemove: vi.fn(),
    onEscape: vi.fn(),
    onUndo: vi.fn(),
    onStep: vi.fn(),
  };
});

interface KeyInit {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  target?: EventTarget | null;
}

function press(init: KeyInit): boolean {
  return handleBoardEditorKey(
    {
      key: init.key,
      shiftKey: init.shiftKey ?? false,
      ctrlKey: init.ctrlKey ?? false,
      metaKey: init.metaKey ?? false,
      altKey: init.altKey ?? false,
      target: init.target ?? null,
    },
    handlers,
  );
}

describe("handleBoardEditorKey", () => {
  it("toggles exhaust and opens the keyword popover", () => {
    expect(press({ key: "e" })).toBe(true);
    expect(press({ key: "K" })).toBe(true);
    expect(handlers.onExhaust).toHaveBeenCalledTimes(1);
    expect(handlers.onKeyword).toHaveBeenCalledTimes(1);
  });

  it("adjusts damage without shift and might with shift", () => {
    press({ key: "-" });
    press({ key: "=" });
    press({ key: "_", shiftKey: true });
    press({ key: "+", shiftKey: true });
    expect(handlers.onDamage).toHaveBeenNthCalledWith(1, -1);
    expect(handlers.onDamage).toHaveBeenNthCalledWith(2, 1);
    expect(handlers.onMight).toHaveBeenNthCalledWith(1, -1);
    expect(handlers.onMight).toHaveBeenNthCalledWith(2, 1);
  });

  it("starts move and target arrows", () => {
    press({ key: "m" });
    press({ key: "t" });
    expect(handlers.onArrow).toHaveBeenNthCalledWith(1, "move");
    expect(handlers.onArrow).toHaveBeenNthCalledWith(2, "target");
  });

  it("removes on delete and backspace", () => {
    expect(press({ key: "Delete" })).toBe(true);
    expect(press({ key: "Backspace" })).toBe(true);
    expect(handlers.onRemove).toHaveBeenCalledTimes(2);
  });

  it("undoes on ctrl+z and cmd+z but not on shift+ctrl+z", () => {
    expect(press({ key: "z", ctrlKey: true })).toBe(true);
    expect(press({ key: "Z", metaKey: true })).toBe(true);
    expect(press({ key: "z", ctrlKey: true, shiftKey: true })).toBe(false);
    expect(handlers.onUndo).toHaveBeenCalledTimes(2);
  });

  it("changes step with the arrow keys and escapes without a selection", () => {
    handlers.hasSelection = false;
    expect(press({ key: "ArrowLeft" })).toBe(true);
    expect(press({ key: "ArrowRight" })).toBe(true);
    expect(press({ key: "Escape" })).toBe(true);
    expect(handlers.onStep).toHaveBeenNthCalledWith(1, -1);
    expect(handlers.onStep).toHaveBeenNthCalledWith(2, 1);
    expect(handlers.onEscape).toHaveBeenCalledTimes(1);
  });

  it("ignores piece shortcuts without a selection", () => {
    handlers.hasSelection = false;
    expect(press({ key: "e" })).toBe(false);
    expect(press({ key: "Delete" })).toBe(false);
    expect(handlers.onExhaust).not.toHaveBeenCalled();
    expect(handlers.onRemove).not.toHaveBeenCalled();
  });

  it("ignores every key while a text field has focus", () => {
    const input = document.createElement("input");
    expect(press({ key: "e", target: input })).toBe(false);
    expect(press({ key: "z", ctrlKey: true, target: input })).toBe(false);
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    expect(press({ key: "Delete", target: editable })).toBe(false);
  });

  it("ignores unknown keys, alt combinations and a disabled editor", () => {
    expect(press({ key: "q" })).toBe(false);
    expect(press({ key: "e", altKey: true })).toBe(false);
    handlers.enabled = false;
    expect(press({ key: "e" })).toBe(false);
    expect(handlers.onExhaust).not.toHaveBeenCalled();
  });
});
