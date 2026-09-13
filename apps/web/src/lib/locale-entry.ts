import type { Locale } from "@/paraglide/runtime.js";
import { baseLocale, cookieMaxAge, cookieName, isLocale } from "@/paraglide/runtime.js";

/**
 * `/de/cards` is an entry point, not a second copy of the site: it redirects to
 * `/cards` and, for a visitor who has not picked a language yet, leaves the
 * locale cookie behind. Someone who already chose is sent on unchanged, so a
 * shared link cannot rewrite their setting.
 */
export function localeEntryRedirect(request: Request): Response | null {
  const url = new URL(request.url);
  const [, prefix = "", ...rest] = url.pathname.split("/");
  if (!isLocale(prefix)) {
    return null;
  }

  const headers = new Headers({ Location: `/${rest.join("/")}${url.search}` });
  if (!hasLocaleCookie(request.headers.get("cookie"))) {
    headers.append("Set-Cookie", localeCookie(prefix));
  }
  return new Response(null, { status: 307, headers });
}

/**
 * The browser's language for a page request that carries no locale cookie yet.
 * The base locale needs no cookie, so that page stays publicly cacheable.
 */
export function browserLocaleForPageRequest(request: Request): Locale | null {
  if (request.method !== "GET" || hasLocaleCookie(request.headers.get("cookie"))) {
    return null;
  }
  if (!(request.headers.get("accept") ?? "").includes("text/html")) {
    return null;
  }
  const locale = localeFromLanguageTags(
    acceptedLanguageTags(request.headers.get("accept-language")),
  );
  return locale === undefined || locale === baseLocale ? null : locale;
}

export function acceptedLanguageTags(header: string | null): string[] {
  if (!header) {
    return [];
  }
  return header
    .split(",")
    .map((entry) => {
      const [tag = "", q = "1"] = entry.trim().split(";q=");
      return { tag, q: Number(q) };
    })
    .filter((entry) => entry.tag !== "")
    .toSorted((a, b) => b.q - a.q)
    .map((entry) => entry.tag);
}

export function localeFromLanguageTags(tags: readonly string[]): Locale | undefined {
  for (const tag of tags) {
    const locale = localeFromLanguageTag(tag);
    if (locale !== undefined) {
      return locale;
    }
  }
  return undefined;
}

const TRADITIONAL_CHINESE_REGIONS = new Set(["TW", "HK", "MO"]);

/** Browsers send zh-CN or zh-TW, never zh-Hans or zh-Hant, so Chinese resolves by script or region. */
function localeFromLanguageTag(tag: string): Locale | undefined {
  const [language = "", ...subtags] = tag.split("-");
  if (language.toLowerCase() === "zh") {
    const upper = subtags.map((subtag) => subtag.toUpperCase());
    return upper.includes("HANT") || upper.some((subtag) => TRADITIONAL_CHINESE_REGIONS.has(subtag))
      ? "zh-Hant"
      : "zh-Hans";
  }
  if (isLocale(tag)) {
    return tag;
  }
  return isLocale(language) ? language : undefined;
}

export function withLocaleCookieRequest(request: Request, locale: Locale): Request {
  const headers = new Headers(request.headers);
  const cookie = headers.get("cookie");
  headers.set("cookie", `${cookie ? `${cookie}; ` : ""}${cookieName}=${locale}`);
  return new Request(request, { headers });
}

export function withLocaleCookieResponse(response: Response, locale: Locale): Response {
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", localeCookie(locale));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function hasLocaleCookie(cookie: string | null | undefined): boolean {
  if (!cookie) {
    return false;
  }
  return new RegExp(`(?:^|;\\s*)${cookieName}=`, "u").test(cookie);
}

function localeCookie(locale: Locale): string {
  return `${cookieName}=${locale}; Path=/; Max-Age=${cookieMaxAge}; SameSite=Lax`;
}
