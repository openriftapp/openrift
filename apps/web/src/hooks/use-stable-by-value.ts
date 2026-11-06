import { useState } from "react";

/**
 * Keeps the previous instance while `value` serializes the same.
 * Only for small JSON-safe values.
 */
export function useStableByValue<T>(value: T): T {
  const key = JSON.stringify(value);
  const [held, setHeld] = useState({ key, value });
  if (held.key !== key) {
    setHeld({ key, value });
    return value;
  }
  return held.value;
}
