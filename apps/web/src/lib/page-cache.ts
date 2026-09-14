// oxlint-disable-next-line import/no-unassigned-import -- import-protection marker
import "@tanstack/react-start/server-only";
import { baseLocale, cookieName } from "@/paraglide/runtime.js";

const PUBLIC_PAGE_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=3600";
const PRIVATE_PAGE_CACHE_CONTROL = "private, no-cache";

// Keep in sync with deploy.sh.example's purge_cloudflare_cache() prefix list.
const EXACT_PATHS = new Set([
  "/",
  "/cards",
  "/sets",
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

function isAnonymousCacheable(request: Request, response: Response, pathname: string): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }
  if (response.status !== 200) {
    return false;
  }
  if (response.headers.has("set-cookie")) {
    return false;
  }
  if (!isCacheablePublicPath(pathname)) {
    return false;
  }
  return !hasSessionCookie(request) && !hasNonBaseLocaleCookie(request);
}

/**
 * Must stay the only place that sets `Cache-Control` on SSR responses: nginx
 * setting it too merges into one header and sticks Cloudflare's edge cache in `UPDATING`.
 */
export function applyPageCacheControl(request: Request, response: Response): Response {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  const url = new URL(request.url);
  const cacheControl = isAnonymousCacheable(request, response, url.pathname)
    ? PUBLIC_PAGE_CACHE_CONTROL
    : PRIVATE_PAGE_CACHE_CONTROL;

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", cacheControl);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
