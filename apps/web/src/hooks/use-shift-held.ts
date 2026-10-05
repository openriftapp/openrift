import { useEffect, useState } from "react";

export function useShiftHeld(): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        setHeld(true);
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        setHeld(false);
      }
    };
    const reset = () => setHeld(false);
    globalThis.addEventListener("keydown", down);
    globalThis.addEventListener("keyup", up);
    // A keyup that lands while another window has focus never reaches this one.
    globalThis.addEventListener("blur", reset);
    return () => {
      globalThis.removeEventListener("keydown", down);
      globalThis.removeEventListener("keyup", up);
      globalThis.removeEventListener("blur", reset);
    };
  }, []);
  return held;
}
