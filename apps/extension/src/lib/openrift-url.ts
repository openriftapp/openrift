import type { PicksPayload } from "./picks";

// wxt.config.ts reads this outside a Vite context, where the value only exists
// on process.env; the bundled code only has import.meta.env.
const BASE_URL: string =
  import.meta.env?.WXT_OPENRIFT_URL ??
  globalThis.process?.env?.WXT_OPENRIFT_URL ??
  "https://openrift.app";

export interface DeckImportExtras {
  name?: string;
  source?: string;
}

export function deckImportUrl(payload: string, extras: DeckImportExtras = {}): string {
  // encodeURIComponent, not URLSearchParams: the latter writes spaces as `+`,
  // which the router's decodeURIComponent-based parser hands back literally.
  const parts = [`code=${encodeURIComponent(payload)}`];
  if (extras.name !== undefined) {
    parts.push(`name=${encodeURIComponent(extras.name)}`);
  }
  if (extras.source !== undefined) {
    parts.push(`source=${encodeURIComponent(extras.source)}`);
  }
  return `${BASE_URL}/decks/import?${parts.join("&")}`;
}

export function overlaySyncUrl(): string {
  return `${BASE_URL}/extension/cardmarket`;
}

export const PICKS_IMPORT_PATH = "/collections/lists/import/cardmarket";

/** The payload rides in the fragment: it never reaches the server and has no length cap to speak of. */
export function picksImportUrl(payload: PicksPayload): string {
  return `${BASE_URL}${PICKS_IMPORT_PATH}#picks=${encodeURIComponent(JSON.stringify(payload))}`;
}

export function openriftOrigin(): string {
  return new URL(BASE_URL).origin;
}

/** Match patterns carry no port, so a dev instance on one grants the whole host. */
export function matchPatternForUrl(base: string): string {
  const url = new URL(base);
  return `${url.protocol}//${url.hostname}/*`;
}

/** Host permissions and URL tests both need the configured instance, not just the public one. */
export function openriftMatchPattern(): string {
  return matchPatternForUrl(BASE_URL);
}

export function isOverlaySyncUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.origin === openriftOrigin() && parsed.pathname === "/extension/cardmarket";
  } catch {
    return false;
  }
}
