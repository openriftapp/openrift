import { cookieMaxAge, cookieName, isLocale } from "@/paraglide/runtime.js";

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
  if (!hasLocaleCookie(request)) {
    headers.append(
      "Set-Cookie",
      `${cookieName}=${prefix}; Path=/; Max-Age=${cookieMaxAge}; SameSite=Lax`,
    );
  }
  return new Response(null, { status: 307, headers });
}

function hasLocaleCookie(request: Request): boolean {
  const cookie = request.headers.get("cookie");
  if (!cookie) {
    return false;
  }
  return new RegExp(`(?:^|;\\s*)${cookieName}=`, "u").test(cookie);
}
