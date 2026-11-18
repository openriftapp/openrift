import { useWindowVirtualizer } from "@tanstack/react-virtual";
import type { PartialKeys, ReactVirtualizerOptions, Virtualizer } from "@tanstack/react-virtual";

/**
 * React Compiler over-memoizes getVirtualItems()/getTotalSize(), so cold-loaded grids render zero rows.
 * Remove "use no memo" once https://github.com/TanStack/virtual/issues/736 is fixed.
 */
export function useWindowVirtualizerFresh<TItemElement extends Element>(
  options: PartialKeys<
    ReactVirtualizerOptions<Window, TItemElement>,
    "getScrollElement" | "observeElementRect" | "observeElementOffset" | "scrollToFn"
  >,
): {
  virtualizer: Virtualizer<Window, TItemElement>;
  virtualItems: ReturnType<Virtualizer<Window, TItemElement>["getVirtualItems"]>;
  totalSize: number;
} {
  "use no memo";
  // oxlint-disable-next-line react/incompatible-library -- see file header
  const virtualizer = useWindowVirtualizer(options);
  return {
    virtualizer,
    virtualItems: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
  };
}
