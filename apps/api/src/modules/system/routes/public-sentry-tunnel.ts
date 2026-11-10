import { createLogger } from "@openrift/shared/logger";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

import type { Fetch } from "../../../io.js";
import { jsonError } from "../../../lib/http-response.js";
import type { Variables } from "../../../types.js";

const log = createLogger("sentry-tunnel");

const MAX_ENVELOPE_BYTES = 1_000_000;

// Tunnels envelopes through our own origin because `*.ingest.sentry.io` is on
// Firefox ETP and ad-blocker blocklists.
// Forward is fire-and-forget: the browser gets a 200 immediately, and the SDK
// never reads the response, so upstream 429s are only logged, not backed off from.
export const sentryTunnelRoute = new Hono<{ Variables: Variables }>().post(
  "/sentry-tunnel",
  bodyLimit({ maxSize: MAX_ENVELOPE_BYTES, onError: (c) => c.body(null, 413) }),
  async (c) => {
    const { sentryDsnSsr } = c.get("config");
    const { fetch } = c.get("io");

    if (!sentryDsnSsr) {
      return jsonError(c, 503, "Sentry tunnel not configured");
    }

    const allowed = new URL(sentryDsnSsr);
    const allowedProjectId = allowed.pathname.replace(/^\/+/u, "");

    const bytes = new Uint8Array(await c.req.raw.arrayBuffer());
    const newlineIdx = bytes.indexOf(0x0a);
    if (newlineIdx === -1) {
      return c.body(null, 400);
    }

    let header: Record<string, unknown>;
    let envelopeDsn: URL;
    try {
      header = JSON.parse(new TextDecoder().decode(bytes.subarray(0, newlineIdx)));
      if (typeof header.dsn !== "string" || !header.dsn) {
        return c.body(null, 400);
      }
      envelopeDsn = new URL(header.dsn);
    } catch {
      return c.body(null, 400);
    }

    const projectId = envelopeDsn.pathname.replace(/^\/+/u, "");
    if (envelopeDsn.host !== allowed.host || projectId !== allowedProjectId) {
      return c.body(null, 400);
    }

    const headers: Record<string, string> = {
      "content-type": c.req.header("content-type") ?? "application/x-sentry-envelope",
    };
    const encoding = c.req.header("content-encoding");
    if (encoding) {
      headers["content-encoding"] = encoding;
    }

    const forwarded = withForwardedFor(header, bytes, newlineIdx, c.req.header("x-real-ip"));
    void forwardEnvelope(fetch, envelopeDsn.host, projectId, headers, forwarded);

    return c.body(null, 200);
  },
);

// Relay reads the client address from the envelope header's `forwarded_for`;
// without it every browser event geolocates to our server.
function withForwardedFor(
  header: Record<string, unknown>,
  bytes: Uint8Array<ArrayBuffer>,
  newlineIdx: number,
  clientIp?: string,
): Uint8Array<ArrayBuffer> {
  if (!clientIp) {
    return bytes;
  }
  const headerLine = new TextEncoder().encode(
    JSON.stringify({ ...header, forwarded_for: clientIp }),
  );
  const rest = bytes.subarray(newlineIdx);
  const out = new Uint8Array(headerLine.length + rest.length);
  out.set(headerLine);
  out.set(rest, headerLine.length);
  return out;
}

async function forwardEnvelope(
  fetch: Fetch,
  ingestHost: string,
  projectId: string,
  headers: Record<string, string>,
  body: Uint8Array<ArrayBuffer>,
): Promise<void> {
  try {
    const upstream = await fetch(`https://${ingestHost}/api/${projectId}/envelope/`, {
      method: "POST",
      headers,
      body,
      redirect: "manual",
    });
    if (!upstream.ok) {
      log.warn({ status: upstream.status, projectId }, "Sentry ingest rejected envelope");
    }
    // Drain so the connection can be released back to the pool.
    await upstream.arrayBuffer();
  } catch (error) {
    log.warn({ error: String(error) }, "Failed to forward envelope to Sentry ingest");
  }
}
