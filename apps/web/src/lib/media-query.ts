const MOBILE_BREAKPOINT = 768;

export const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";

export function matchesMediaQuery(query: string): boolean {
  return typeof globalThis.matchMedia === "function" && globalThis.matchMedia(query).matches;
}

export function prefersReducedMotion(): boolean {
  return matchesMediaQuery(REDUCED_MOTION_QUERY);
}
