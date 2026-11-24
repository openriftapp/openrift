import { useState } from "react";

/**
 * A value created on the first render and kept for the life of the component.
 * @returns The value the factory produced.
 */
export function useConstant<T>(factory: () => T): T {
  // oxlint-disable-next-line react/hook-use-state -- the value is never replaced, so there is no setter
  const [value] = useState(factory);
  return value;
}
