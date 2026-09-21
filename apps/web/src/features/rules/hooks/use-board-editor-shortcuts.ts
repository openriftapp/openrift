import { useEffect, useRef } from "react";

export interface BoardEditorShortcutHandlers {
  hasSelection: boolean;
  enabled?: boolean;
  onExhaust?: () => void;
  onKeyword?: () => void;
  onDamage?: (delta: number) => void;
  onMight?: (delta: number) => void;
  onArrow?: (kind: "move" | "target") => void;
  onRemove?: () => void;
  onEscape: () => void;
  onUndo: () => void;
  onStep: (delta: number) => void;
}

function isTextEntry(target: EventTarget | null): boolean {
  if (target === null || !("tagName" in target)) {
    return false;
  }
  const element = target as HTMLElement;
  const tag = element.tagName;
  return (
    tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || element.isContentEditable === true
  );
}

/**
 * Applies one keystroke to the editor.
 *
 * @returns Whether the keystroke was consumed and the caller should call `preventDefault`.
 */
export function handleBoardEditorKey(
  event: Pick<KeyboardEvent, "key" | "shiftKey" | "ctrlKey" | "metaKey" | "altKey" | "target">,
  handlers: BoardEditorShortcutHandlers,
): boolean {
  if (handlers.enabled === false || isTextEntry(event.target)) {
    return false;
  }
  const modified = event.ctrlKey || event.metaKey;
  if (modified) {
    if (event.key.toLowerCase() === "z" && !event.shiftKey && !event.altKey) {
      handlers.onUndo();
      return true;
    }
    return false;
  }
  if (event.altKey) {
    return false;
  }
  if (event.key === "Escape") {
    handlers.onEscape();
    return true;
  }
  if (event.key === "ArrowLeft") {
    handlers.onStep(-1);
    return true;
  }
  if (event.key === "ArrowRight") {
    handlers.onStep(1);
    return true;
  }
  if (!handlers.hasSelection) {
    return false;
  }
  if (event.key === "-" || event.key === "_") {
    if (event.shiftKey) {
      handlers.onMight?.(-1);
    } else {
      handlers.onDamage?.(-1);
    }
    return true;
  }
  if (event.key === "+" || event.key === "=") {
    if (event.shiftKey) {
      handlers.onMight?.(1);
    } else {
      handlers.onDamage?.(1);
    }
    return true;
  }
  if (event.key === "Delete" || event.key === "Backspace") {
    handlers.onRemove?.();
    return true;
  }
  switch (event.key.toLowerCase()) {
    case "e": {
      handlers.onExhaust?.();
      return true;
    }
    case "k": {
      handlers.onKeyword?.();
      return true;
    }
    case "m": {
      handlers.onArrow?.("move");
      return true;
    }
    case "t": {
      handlers.onArrow?.("target");
      return true;
    }
    default: {
      return false;
    }
  }
}

export function useBoardEditorShortcuts(handlers: BoardEditorShortcutHandlers): void {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (handleBoardEditorKey(event, latest.current)) {
        event.preventDefault();
      }
    };
    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, []);
}
