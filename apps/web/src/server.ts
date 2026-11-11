// Must be the first imports: initialize Sentry + OTel before any request handling.
// oxlint-disable-next-line import/no-unassigned-import -- side-effect instrumentation bootstrap
import "./instrument.server.mjs";
// oxlint-disable-next-line import/no-unassigned-import -- side-effect instrumentation bootstrap
import "./tracing.server";
import type { ErrataListResponse } from "@openrift/shared/contracts/errata";
import type { SetListResponse, SitemapDataResponse } from "@openrift/shared/types/api/catalog";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

import changelogMd from "./CHANGELOG.md?raw";
import { helpArticleList } from "./features/marketing/components/articles";
import { deriveSetEras } from "./features/meta/lib/meta-scope";
import {
  buildProdRobotsTxt,
  isIndexableRequest,
  NOINDEX_ROBOTS_TXT,
  withNoindex,
} from "./lib/indexing";
import { botBlockedResponse } from "./lib/known-bot";
import {
  browserLocaleForPageRequest,
  localeEntryRedirect,
  withLocaleCookieRequest,
  withLocaleCookieResponse,
} from "./lib/locale-entry";
import { applyPageCacheControl } from "./lib/page-cache";
import { fetchApiJson } from "./lib/server-fns/fetch-api";
import type { SitemapInput } from "./lib/sitemap";
import { latestChangelogDate, latestErrataDate } from "./lib/sitemap";
import { createSitemapResponder } from "./lib/sitemap-response";
import { paraglideMiddleware } from "./paraglide/server.js";

const LOG_SSR_TIMINGS = process.env.LOG_SSR_TIMINGS === "true";

const CHANGELOG_DATE = latestChangelogDate(changelogMd);

function getSiteUrl(): string {
  // Must stay in sync with runtime-config.ts.
  return process.env.SITE_URL ?? "http://localhost:5173";
}

async function sitemapInput(): Promise<SitemapInput> {
  const [data, sets, errata] = await Promise.all([
    fetchApiJson<SitemapDataResponse>({
      errorTitle: "Couldn't load sitemap data",
      path: "/api/v1/sitemap-data",
    }),
    fetchApiJson<SetListResponse>({ errorTitle: "Couldn't load sets", path: "/api/v1/sets" }),
    fetchApiJson<ErrataListResponse>({
      errorTitle: "Couldn't load errata",
      path: "/api/v1/errata",
    }),
  ]);
  return {
    siteUrl: getSiteUrl(),
    changelogDate: CHANGELOG_DATE,
    errataDate: latestErrataDate(errata),
    data,
    eras: deriveSetEras(sets.sets),
    helpArticles: helpArticleList,
  };
}

// The archive alone holds more URLs than one sitemap may, so `/sitemap.xml` is
// an index and each section its own file, split further past the per-file limit.
const sitemapResponse = createSitemapResponder({ load: sitemapInput });

// Not wrapped in wrapFetchWithSentry: it injects <meta> tags into <head> outside
// React's render tree, which our hydrateRoot(document) throws #418 on (prod-only).
export default createServerEntry({
  async fetch(request: Request) {
    const url = new URL(request.url);
    const indexable = isIndexableRequest(request);
    if (url.pathname === "/health") {
      return new Response("ok", { status: 200 });
    }
    if (url.pathname === "/robots.txt") {
      return new Response(indexable ? buildProdRobotsTxt(getSiteUrl()) : NOINDEX_ROBOTS_TXT, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
    const sitemap = await sitemapResponse(request);
    if (sitemap !== null) {
      return sitemap;
    }
    const botBlocked = botBlockedResponse(request);
    if (botBlocked !== null) {
      return botBlocked;
    }
    const localeEntry = localeEntryRedirect(request);
    if (localeEntry !== null) {
      return localeEntry;
    }
    const t0 = LOG_SSR_TIMINGS ? performance.now() : 0;
    const browserLocale = browserLocaleForPageRequest(request);
    const localeRequest =
      browserLocale === null ? request : withLocaleCookieRequest(request, browserLocale);
    // Locale comes from a cookie, not the URL, so there's nothing for the
    // middleware to delocalize; it only detects the locale and wraps the
    // request in AsyncLocalStorage. /health, /robots.txt and the sitemaps
    // above stay outside it on purpose.
    // Cloudflare turns the Link header into 103 Early Hints; Bun cannot write 103 itself.
    // Cloudflare only acts on preload/preconnect, and the modulepreload list runs to ~10 KB.
    const response = await paraglideMiddleware(localeRequest, () =>
      handler.fetch(localeRequest, {
        responseLinkHeader: { filter: ({ hint }) => hint.rel !== "modulepreload" },
      }),
    );
    const tHandler = LOG_SSR_TIMINGS ? performance.now() : 0;
    const cachedResponse = applyPageCacheControl(
      request,
      browserLocale === null ? response : withLocaleCookieResponse(response, browserLocale),
    );
    const finalResponse = indexable ? cachedResponse : withNoindex(cachedResponse);
    if (LOG_SSR_TIMINGS) {
      const tEnd = performance.now();
      console.info(
        `[SSR] ${request.method} ${url.pathname} total=${(tEnd - t0).toFixed(0)}ms handler=${(tHandler - t0).toFixed(0)}ms postprocess=${(tEnd - tHandler).toFixed(0)}ms`,
      );
    }
    return finalResponse;
  },
});
