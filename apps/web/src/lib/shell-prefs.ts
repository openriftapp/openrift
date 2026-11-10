import type { Palette } from "@openrift/shared/types/api/preferences";
import { PALETTES, PREFERENCE_DEFAULTS } from "@openrift/shared/types/api/preferences";

// The client-side resolver here MUST NOT fetch over HTTP: root beforeLoad runs on every
// navigation, including search-param-only ones, and a network round trip would block it.

// The server can't check matchMedia, so "auto" resolves to "light" there and the
// blocking SHELL_PREFS_SCRIPT corrects the class on the client.
export function resolveThemeFromCookie(
  raw: string | null | undefined,
  systemDark = false,
): "light" | "dark" {
  if (!raw) {
    return "dark";
  }
  try {
    const parsed = JSON.parse(raw) as { state?: { preference?: unknown } } | null;
    const preference = parsed?.state?.preference;
    if (preference === "light") {
      return "light";
    }
    if (preference === "auto") {
      return systemDark ? "dark" : "light";
    }
    return "dark";
  } catch {
    return "dark";
  }
}

export function systemPrefersDark(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
}

// Unknown values are clamped so untrusted cookie content never reaches the DOM.
export function resolvePaletteFromCookie(raw: string | null | undefined): Palette {
  if (!raw) {
    return "default";
  }
  try {
    const parsed = JSON.parse(raw) as { state?: { preference?: unknown } } | null;
    const preference = parsed?.state?.preference;
    if (typeof preference === "string" && (PALETTES as readonly string[]).includes(preference)) {
      return preference as Palette;
    }
    return "default";
  } catch {
    return "default";
  }
}

// Mirrors the cookie format written by cookie-storage.ts (URL-encoded name and value).
export function readClientCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const encoded = encodeURIComponent(name);
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${encoded}=`));
  if (!match) {
    return null;
  }
  return decodeURIComponent(match.split("=").slice(1).join("="));
}

// Runs before first paint and both sets and clears, because an edge-cached shell
// carries the defaults, not this visitor's cookies. Resolves like the functions above.
export const SHELL_PREFS_SCRIPT = [
  "(function(){var d=document.documentElement;",
  "function r(n){try{",
  String.raw`var m=document.cookie.match(new RegExp("(?:^|;\\s*)"+n+"=([^;]*)"));`,
  "var p=m&&JSON.parse(decodeURIComponent(m[1]));return p&&p.state&&p.state.preference",
  "}catch(e){return null}}",
  'var t=r("theme");',
  'd.classList.toggle("dark",t==="auto"?typeof matchMedia==="function"&&matchMedia("(prefers-color-scheme: dark)").matches:t!=="light");',
  'var p=r("palette");',
  `d.setAttribute("data-palette",${JSON.stringify(PALETTES)}.indexOf(p)<0?${JSON.stringify(PREFERENCE_DEFAULTS.palette)}:p)`,
  "})()",
].join("");
