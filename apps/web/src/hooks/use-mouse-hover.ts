import type { PointerEvent } from "react";
import { useState } from "react";

/**
 * iOS Safari synthesizes a hover on the first tap of any hoverable element
 * with no matching leave event, so `onMouseEnter` alone would stick open.
 */
export function useMouseHover(): {
  hovering: boolean;
  /** Cursor x where the pointer entered; undefined while not hovering. */
  enterX: number | undefined;
  hoverProps: {
    onPointerEnter: (event: PointerEvent) => void;
    onPointerLeave: (event: PointerEvent) => void;
  };
} {
  const [enterX, setEnterX] = useState<number | undefined>();

  return {
    hovering: enterX !== undefined,
    enterX,
    hoverProps: {
      onPointerEnter: (event: PointerEvent) => {
        if (event.pointerType === "mouse") {
          setEnterX(event.clientX);
        }
      },
      onPointerLeave: (event: PointerEvent) => {
        if (event.pointerType === "mouse") {
          setEnterX(undefined);
        }
      },
    },
  };
}
