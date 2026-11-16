import type { AsyncLocalStorage } from "node:async_hooks";

import { X_TSS_RAW_RESPONSE } from "@tanstack/react-start";
import { createClientRpc } from "@tanstack/react-start/client-rpc";
import { afterEach, describe, expect, it, vi } from "vitest";

import { isStaleServerFnError } from "@/lib/stale-bundle-reload";
import { STALE_SERVER_FN_HEADER } from "@/lib/stale-server-fn-signal";

import { isApiError } from "./api-error";
import { serverFnFetch } from "./server-fn-fetch";

const URL = "/_serverFn/abc";

function stubFetch(response: Response) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
}

function staleResponse(body = "") {
  return new Response(body, {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8", [STALE_SERVER_FN_HEADER]: "1" },
  });
}

const HTML_PAGE = "<html><body><h1>500 Internal Server Error</h1></body></html>";

function htmlResponse(status: number, body = HTML_PAGE) {
  return new Response(body, { status, headers: { "content-type": "text/html" } });
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers });
}

describe("a server-function call through Start's client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // Uncompiled, Start reads its options from this server-side storage, not from window.
  const startStorage = (globalThis as Record<symbol, unknown>)[
    Symbol.for("tanstack-start:start-storage-context")
  ] as AsyncLocalStorage<{ startOptions: unknown }>;

  function call(serverFns: { fetch?: typeof serverFnFetch }) {
    return startStorage.run({ startOptions: { serverFns } }, () =>
      createClientRpc("fn-id")({ method: "POST", data: { podId: "pod-1" } }),
    );
  }

  it("resolves a proxy's JSON 502 as the result without the app's fetch", async () => {
    stubFetch(jsonResponse({ message: "upstream timed out" }, 502));
    await expect(call({})).resolves.toEqual({ message: "upstream timed out" });
  });

  it("rejects the same response once the app's fetch is the start option", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubFetch(jsonResponse({ message: "upstream timed out" }, 502));
    await expect(call({ fetch: serverFnFetch })).rejects.toMatchObject({ status: 502 });
  });

  it("rejects a proxy's HTML 500 with its markup as the message without the app's fetch", async () => {
    stubFetch(htmlResponse(500));
    await expect(call({})).rejects.toThrow(HTML_PAGE);
  });

  it("rejects the stale-function signal with the stale error through the app's fetch", async () => {
    stubFetch(staleResponse());
    const error: unknown = await call({ fetch: serverFnFetch }).catch((error_: unknown) => error_);
    expect(isStaleServerFnError(error)).toBe(true);
  });

  it("rejects a proxy's HTML 500 with an empty message through the app's fetch", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubFetch(htmlResponse(500));
    await expect(call({ fetch: serverFnFetch })).rejects.toMatchObject({
      status: 500,
      message: "",
    });
  });
});

describe("serverFnFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns an ok response untouched", async () => {
    const response = jsonResponse({ ok: true }, 200);
    stubFetch(response);
    await expect(serverFnFetch(URL, { method: "POST" })).resolves.toBe(response);
  });

  it("returns the error Start serialized, so the call rejects with the app's own error", async () => {
    const response = jsonResponse({ t: 1 }, 500, { "x-tss-serialized": "true" });
    stubFetch(response);
    await expect(serverFnFetch(URL, { method: "POST" })).resolves.toBe(response);
  });

  it("rejects a non-ok JSON body Start did not serialize", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubFetch(jsonResponse({ message: "upstream timed out" }, 502));
    const error: unknown = await serverFnFetch(URL, { method: "POST" }).catch(
      (error_: unknown) => error_,
    );
    expect(isApiError(error)).toBe(true);
    expect(error).toMatchObject({ status: 502, message: "" });
  });

  it("rejects an unserialized API error envelope with its message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubFetch(jsonResponse({ error: "Round is closed", code: "CONFLICT" }, 500));
    await expect(serverFnFetch(URL, { method: "POST" })).rejects.toMatchObject({
      status: 500,
      message: "Round is closed",
    });
  });

  it("rejects a non-JSON error with its status and an empty message", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubFetch(htmlResponse(502));
    const error: unknown = await serverFnFetch(URL, { method: "POST" }).catch(
      (error_: unknown) => error_,
    );
    expect(isApiError(error)).toBe(true);
    expect(error).toMatchObject({ status: 502, message: "" });
    expect(log).toHaveBeenCalledWith(
      "[Server function failed]",
      expect.objectContaining({ status: 502 }),
    );
  });

  it("rejects an error without a content type", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubFetch(new Response(null, { status: 503 }));
    await expect(serverFnFetch(URL, { method: "POST" })).rejects.toMatchObject({
      status: 503,
      message: "",
    });
  });

  it("logs only the start of a large non-JSON error body", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubFetch(htmlResponse(500, `<html>${"x".repeat(100_000)}</html>`));
    await serverFnFetch(URL, { method: "POST" }).catch(() => undefined);
    const logged = log.mock.calls[0]?.[1] as { body: string };
    expect(logged.body.length).toBeLessThanOrEqual(500);
  });

  it("rejects the stale-function signal by its header, whatever the body says", async () => {
    stubFetch(staleResponse("anything"));
    const error: unknown = await serverFnFetch(URL, { method: "POST" }).catch(
      (error_: unknown) => error_,
    );
    expect(isStaleServerFnError(error)).toBe(true);
    expect(isApiError(error)).toBe(false);
  });

  it("treats a plain-text 404 without the header as an ordinary failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubFetch(
      new Response("Server function info not found for abc", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      }),
    );
    const error: unknown = await serverFnFetch(URL, { method: "POST" }).catch(
      (error_: unknown) => error_,
    );
    expect(isStaleServerFnError(error)).toBe(false);
    expect(error).toMatchObject({ status: 404 });
  });

  it("returns an ok non-JSON response untouched", async () => {
    const response = new Response("plain", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
    stubFetch(response);
    await expect(serverFnFetch(URL, { method: "POST" })).resolves.toBe(response);
  });

  it.each(["true", "thrown"])(
    "returns a raw response (x-tss-raw: %s) for Start to handle",
    async (raw) => {
      const response = htmlResponse(500);
      response.headers.set(X_TSS_RAW_RESPONSE, raw);
      stubFetch(response);
      await expect(serverFnFetch(URL, { method: "POST" })).resolves.toBe(response);
    },
  );

  it("returns a not-found body so the router still shows the not-found page", async () => {
    const response = jsonResponse({ isNotFound: true }, 404);
    stubFetch(response);
    await expect(serverFnFetch(URL, { method: "GET" })).resolves.toBe(response);
  });

  it("returns a serialized redirect so the router still follows it", async () => {
    const response = jsonResponse({ isSerializedRedirect: true, href: "/" }, 307);
    stubFetch(response);
    await expect(serverFnFetch(URL, { method: "GET" })).resolves.toBe(response);
  });
});
