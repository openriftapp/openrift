// oxlint-disable-next-line import/no-unassigned-import -- import-protection marker
import "@tanstack/react-start/server-only";
import { HOUR_MS } from "@openrift/shared/format-date";

import { isIndexableRequest } from "./indexing";
import type { SitemapInput } from "./sitemap";
import {
  parseSitemapPath,
  renderSitemapFile,
  renderSitemapIndex,
  SITEMAP_INDEX_PATH,
} from "./sitemap";

export const SITEMAP_CACHE_CONTROL = "public, max-age=3600, stale-while-revalidate=7200";

const SITEMAP_DATA_TTL_MS = HOUR_MS;

interface RenderedFile {
  body: string;
  etag: string;
}

interface Generation {
  input: SitemapInput;
  loadedAt: number;
  files: Map<string, Promise<RenderedFile | null>>;
}

interface SitemapResponderOptions {
  load: () => Promise<SitemapInput>;
  now?: () => number;
  ttlMs?: number;
}

function opaqueTag(etag: string): string {
  return etag.startsWith("W/") ? etag.slice(2) : etag;
}

function matchesIfNoneMatch(header: string | null, etag: string): boolean {
  if (header === null) {
    return false;
  }
  if (header.trim() === "*") {
    return true;
  }
  const ours = opaqueTag(etag);
  return header.split(",").some((candidate) => opaqueTag(candidate.trim()) === ours);
}

async function contentEtag(body: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"));
  return `W/"${hex.join("")}"`;
}

async function renderFile(pathname: string, input: SitemapInput): Promise<RenderedFile | null> {
  const file = parseSitemapPath(pathname);
  const body =
    pathname === SITEMAP_INDEX_PATH
      ? renderSitemapIndex(input)
      : file === null
        ? null
        : renderSitemapFile(file.section, file.index, input);
  if (body === null) {
    return null;
  }
  return { body, etag: await contentEtag(body) };
}

/**
 * Serves `/sitemap.xml` and `/sitemap-*.xml`. Returns null for any other path,
 * and for a `/sitemap-` path that names no section, so the page handler answers it.
 */
export function createSitemapResponder({
  load,
  now = Date.now,
  ttlMs = SITEMAP_DATA_TTL_MS,
}: SitemapResponderOptions): (request: Request) => Promise<Response | null> {
  let current: Generation | null = null;
  let pending: Promise<Generation> | null = null;

  async function loadGeneration(): Promise<Generation> {
    try {
      current = { input: await load(), loadedAt: now(), files: new Map() };
      return current;
    } finally {
      pending = null;
    }
  }

  function refresh(): Promise<Generation> {
    pending ??= loadGeneration();
    return pending;
  }

  async function generation(): Promise<Generation> {
    if (current === null) {
      return await refresh();
    }
    const previous = current;
    if (now() - previous.loadedAt < ttlMs) {
      return previous;
    }
    try {
      return await refresh();
    } catch {
      // A failed refresh keeps serving the previous data; the next request retries.
      return previous;
    }
  }

  return async function sitemapResponse(request) {
    const { pathname } = new URL(request.url);
    if (pathname !== SITEMAP_INDEX_PATH && !pathname.startsWith("/sitemap-")) {
      return null;
    }
    if (!isIndexableRequest(request)) {
      return new Response("Not found", { status: 404 });
    }
    if (pathname !== SITEMAP_INDEX_PATH && parseSitemapPath(pathname) === null) {
      return null;
    }
    let file: RenderedFile | null;
    try {
      const gen = await generation();
      let rendered = gen.files.get(pathname);
      if (rendered === undefined) {
        rendered = renderFile(pathname, gen.input);
        gen.files.set(pathname, rendered);
      }
      file = await rendered;
    } catch {
      return new Response("Sitemap generation failed", { status: 500 });
    }
    if (file === null) {
      return new Response("Not found", { status: 404 });
    }
    const headers = { "Cache-Control": SITEMAP_CACHE_CONTROL, ETag: file.etag };
    if (matchesIfNoneMatch(request.headers.get("if-none-match"), file.etag)) {
      return new Response(null, { status: 304, headers });
    }
    return new Response(file.body, {
      headers: { ...headers, "Content-Type": "application/xml" },
    });
  };
}
