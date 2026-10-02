// oxlint-disable-next-line import/no-unassigned-import -- import-protection marker
import "@tanstack/react-start/server-only";
import { baseLocale, cookieName } from "@/paraglide/runtime.js";

const PUBLIC_PAGE_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=3600";
const PRIVATE_PAGE_CACHE_CONTROL = "private, no-cache";
// A dated rules version never changes after import; the API's admin rules routes purge it on change.
const RULES_VERSION_CACHE_CONTROL =
  "public, max-age=300, s-maxage=86400, stale-while-revalidate=86400";
const RULES_VERSION_PATH_REGEX = /^\/rules\/(?:core|tournament)\/\d{4}-\d{2}-\d{2}$/u;
const RULES_KIND_PATH_REGEX = /^\/rules\/(?:core|tournament)$/u;
const RULES_LANGUAGE_SEARCH_REGEX = /^(?:\?lang=[A-Za-z-]+)?$/u;
const REDIRECT_STATUSES = new Set([301, 302, 307, 308]);

// Keep in sync with deploy.sh.example's purge_cloudflare_cache() prefix list.
const EXACT_PATHS = new Set([
  "/",
  "/cards",
  "/sets",
  "/errata",
  "/rules",
  "/privacy-policy",
  "/promos",
  "/products",
  "/help",
  "/meta",
  "/changelog",
  "/roadmap",
  "/features",
  "/support",
  "/legal-notice",
  "/glossary",
]);
const PREFIX_PATHS = [
  "/cards/",
  "/sets/",
  "/rules/",
  "/promos/",
  "/products/",
  "/help/",
  "/meta/",
  "/decks/share/",
  "/collections/share/",
  "/lists/share/",
  "/tier-lists/share/",
  "/users/share/",
];

function isCacheablePublicPath(pathname: string): boolean {
  if (EXACT_PATHS.has(pathname)) {
    return true;
  }
  return PREFIX_PATHS.some((prefix) => pathname.startsWith(prefix));
}

function hasSessionCookie(request: Request): boolean {
  const cookie = request.headers.get("cookie");
  if (!cookie) {
    return false;
  }
  return /better-auth\.session_token/u.test(cookie);
}

// Locale lives in a cookie, not the URL, so a translated page must never be
// stored under the plain URL and served to everyone behind it.
function hasNonBaseLocaleCookie(request: Request): boolean {
  const cookie = request.headers.get("cookie");
  if (!cookie) {
    return false;
  }
  const match = new RegExp(`(?:^|;\\s*)${cookieName}=([^;]*)`, "u").exec(cookie);
  return match !== null && decodeURIComponent(match[1] ?? "") !== baseLocale;
}

function isAnonymousCacheable(request: Request, response: Response): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }
  if (response.headers.has("set-cookie")) {
    return false;
  }
  return !hasSessionCookie(request) && !hasNonBaseLocaleCookie(request);
}

function withCacheControl(response: Response, cacheControl: string): Response {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", cacheControl);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Must stay the only place that sets `Cache-Control` on SSR responses: nginx
 * setting it too merges into one header and sticks Cloudflare's edge cache in `UPDATING`.
 */
export function applyPageCacheControl(request: Request, response: Response): Response {
  const { pathname, search } = new URL(request.url);
  if (
    REDIRECT_STATUSES.has(response.status) &&
    (RULES_KIND_PATH_REGEX.test(pathname) || RULES_VERSION_PATH_REGEX.test(pathname))
  ) {
    return isAnonymousCacheable(request, response)
      ? withCacheControl(response, PUBLIC_PAGE_CACHE_CONTROL)
      : response;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  if (
    response.status !== 200 ||
    !isCacheablePublicPath(pathname) ||
    !isAnonymousCacheable(request, response)
  ) {
    return withCacheControl(response, PRIVATE_PAGE_CACHE_CONTROL);
  }
  return withCacheControl(
    response,
    RULES_VERSION_PATH_REGEX.test(pathname) && RULES_LANGUAGE_SEARCH_REGEX.test(search)
      ? RULES_VERSION_CACHE_CONTROL
      : PUBLIC_PAGE_CACHE_CONTROL,
  );
}
