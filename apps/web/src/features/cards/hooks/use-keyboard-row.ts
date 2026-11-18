import type { FocusEvent } from "react";
import { useEffect, useState } from "react";

/** The grid row holding a keyboard-focused element, null for pointer focus or focus outside a row. */
function keyboardRowOf(target: Element): number | null {
  if (!target.matches(":focus-visible")) {
    return null;
  }
  const index = target.closest<HTMLElement>("[data-index]")?.dataset.index;
  return index === undefined ? null : Number(index);
}

/**
 * The virtual row that holds keyboard focus inside `container`. A filter, sort or removal of
 * `items` can unmount the focused tile without a blur, so a change that leaves the focus outside
 * drops the row.
 */
export function useKeyboardRow(
  container: HTMLElement | null,
  items: readonly unknown[],
): {
  keyboardRow: number | null;
  onFocus: (event: FocusEvent<HTMLElement>) => void;
  onBlur: (event: FocusEvent<HTMLElement>) => void;
} {
  const [keyboardRow, setKeyboardRow] = useState<number | null>(null);

  useEffect(() => {
    if (keyboardRow !== null && !container?.contains(document.activeElement)) {
      // oxlint-disable-next-line react/set-state-in-effect -- syncs with the DOM focus, which fires no event when its element is removed
      setKeyboardRow(null);
    }
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- a change of `items` is what can unmount the focused tile
  }, [container, items, keyboardRow]);

  return {
    keyboardRow,
    onFocus: (event) => setKeyboardRow(keyboardRowOf(event.target)),
    onBlur: (event) => {
      const next = event.relatedTarget;
      if (!(next instanceof Node && event.currentTarget.contains(next))) {
        setKeyboardRow(null);
      }
    },
  };
}
