import type { AnyRouter, ParsedLocation } from "@tanstack/react-router";

declare module "@tanstack/react-router" {
  interface HistoryState {
    overlayEntry?: boolean;
  }
}

let lastFromLocation: ParsedLocation | undefined;

export function trackScrollRestorationSource(router: AnyRouter): void {
  router.subscribe("onBeforeLoad", ({ fromLocation }) => {
    lastFromLocation = fromLocation;
  });
}

/**
 * The router's `scrollRestoration` option. Leaving an overlay entry for the page
 * under it keeps the scroll; restoring would jump back to the open-time position.
 */
export function shouldRestoreScroll({ location }: { location: ParsedLocation }): boolean {
  const from = lastFromLocation;
  return !(from?.state.overlayEntry && from.href === location.href);
}
