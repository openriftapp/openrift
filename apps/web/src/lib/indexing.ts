// oxlint-disable-next-line import/no-unassigned-import -- import-protection marker
import "@tanstack/react-start/server-only";
import { isOfficialHostname } from "./official-host";
import { SITEMAP_INDEX_PATH } from "./sitemap";

export const NOINDEX_ROBOTS_TXT = "User-agent: *\nAllow: /\n";

export function isIndexableRequest(request: Request): boolean {
  return isOfficialHostname(new URL(request.url).hostname);
}

export function withNoindex(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function buildProdRobotsTxt(siteUrl: string): string {
  return [
    "User-agent: *",
    "Allow: /",
    "",
    "# Share pages are unlisted via a noindex meta tag on the page itself.",
    "# Crawling must stay allowed so engines can see that tag — a robots block",
    "# alone would leave externally-linked share URLs indexable.",
    "Allow: /collections/share/",
    "Allow: /decks/share/",
    "",
    "# Authenticated-only routes (not useful to crawlers)",
    "Disallow: /collections",
    "Disallow: /decks",
    "Disallow: /profile",
    "Disallow: /admin",
    "",
    "# Auth flows",
    "Disallow: /login",
    "Disallow: /signup",
    "Disallow: /reset-password",
    "Disallow: /verify-email",
    "Disallow: /meta/submit",
    "Disallow: /meta/*/submit",
    "",
    `Sitemap: ${siteUrl}${SITEMAP_INDEX_PATH}`,
    "",
  ].join("\n");
}
