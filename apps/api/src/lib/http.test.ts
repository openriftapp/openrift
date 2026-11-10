import { describe, expect, it, vi } from "vitest";

import type { Fetch } from "../io.js";
import { fetchJson, fetchOk } from "./http.js";

describe("fetchJson", () => {
  it("returns parsed JSON body and null lastModified when no header", async () => {
    const mockFetch: Fetch = async () => Response.json({ hello: "world" }, { status: 200 });

    const result = await fetchJson<{ hello: string }>(mockFetch, "https://example.com/api");
    expect(result.data).toEqual({ hello: "world" });
    expect(result.lastModified).toBeNull();
  });

  it("parses Last-Modified header into a Date", async () => {
    const mockFetch: Fetch = async () =>
      Response.json(
        { ok: true },
        {
          status: 200,
          headers: { "Last-Modified": "Wed, 01 Jan 2025 00:00:00 GMT" },
        },
      );

    const result = await fetchJson(mockFetch, "https://example.com/api");
    expect(result.lastModified).toBeInstanceOf(Date);
    expect(result.lastModified?.toISOString()).toBe("2025-01-01T00:00:00.000Z");
  });

  it("throws on non-OK response (404)", async () => {
    const mockFetch: Fetch = async () => new Response("Not Found", { status: 404 });

    await expect(fetchJson(mockFetch, "https://example.com/missing")).rejects.toThrow("HTTP 404");
  });

  it("throws on non-OK response (500)", async () => {
    const mockFetch: Fetch = async () => new Response("Internal Server Error", { status: 500 });

    await expect(fetchJson(mockFetch, "https://example.com/error")).rejects.toThrow("HTTP 500");
  });

  it("includes URL in error message", async () => {
    const mockFetch: Fetch = async () => new Response("Gone", { status: 410 });

    await expect(fetchJson(mockFetch, "https://example.com/gone")).rejects.toThrow(
      "https://example.com/gone",
    );
  });

  it("includes response body text in error message", async () => {
    const mockFetch: Fetch = async () => new Response("custom error body", { status: 502 });

    await expect(fetchJson(mockFetch, "https://example.com/bad")).rejects.toThrow(
      "custom error body",
    );
  });

  it("returns null lastModified when Last-Modified header is absent", async () => {
    const mockFetch: Fetch = async () =>
      Response.json(
        { data: 123 },
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const result = await fetchJson<{ data: number }>(mockFetch, "https://example.com/api");
    expect(result.lastModified).toBeNull();
    expect(result.data).toEqual({ data: 123 });
  });

  it("passes a signal option to fetch for timeout", async () => {
    let capturedInit: RequestInit | undefined;
    const mockFetch: Fetch = async (_url, init?) => {
      capturedInit = init;
      return Response.json({ ok: true }, { status: 200 });
    };

    await fetchJson(mockFetch, "https://example.com/api");
    expect(capturedInit?.signal).toBeDefined();
  });

  it("sends the given headers and honors a custom timeout", async () => {
    let capturedInit: RequestInit | undefined;
    const mockFetch: Fetch = async (_url, init?) => {
      capturedInit = init;
      return Response.json({ ok: true }, { status: 200 });
    };

    await fetchJson(mockFetch, "https://example.com/api", {
      headers: { "User-Agent": "OpenRift" },
      timeoutMs: 30_000,
    });
    expect(capturedInit?.headers).toEqual({ "User-Agent": "OpenRift" });
    expect(capturedInit?.signal).toBeDefined();
  });

  it("maps the body through transform", async () => {
    const mockFetch: Fetch = async () => Response.json({ array: [1, 2] }, { status: 200 });

    const result = await fetchJson(mockFetch, "https://example.com/api", {
      transform: (body) => (body as { array: number[] }).array,
    });
    expect(result.data).toEqual([1, 2]);
  });

  it("does not call transform on an error response", async () => {
    const mockFetch: Fetch = async () => new Response("nope", { status: 500 });
    let called = false;

    await expect(
      fetchJson(mockFetch, "https://example.com/api", {
        transform: () => {
          called = true;
          return null;
        },
      }),
    ).rejects.toThrow("HTTP 500");
    expect(called).toBe(false);
  });
});

describe("fetchOk retries", () => {
  const URL = "https://example.com/prices";

  function sequence(...steps: (number | Error)[]) {
    return vi.fn<Fetch>(async () => {
      const step = steps.shift() ?? 200;
      if (step instanceof Error) {
        throw step;
      }
      return Response.json({ ok: step === 200 }, { status: step });
    });
  }

  it("does not retry unless asked", async () => {
    const fetchFn = sequence(502, 200);
    await expect(fetchOk(fetchFn, URL)).rejects.toThrow("HTTP 502");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("retries a 5xx and returns the later success", async () => {
    const fetchFn = sequence(502, 503, 200);
    const res = await fetchOk(fetchFn, URL, { retries: 2, retryDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("retries a network error", async () => {
    const fetchFn = sequence(new TypeError("fetch failed"), 200);
    const { data } = await fetchJson<{ ok: boolean }>(fetchFn, URL, {
      retries: 2,
      retryDelayMs: 1,
    });
    expect(data).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 4xx", async () => {
    const fetchFn = sequence(404, 200);
    await expect(fetchOk(fetchFn, URL, { retries: 2, retryDelayMs: 1 })).rejects.toThrow(
      "HTTP 404",
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("gives up with the last error once the retries are spent", async () => {
    const fetchFn = sequence(500, 502, 503, 200);
    await expect(fetchOk(fetchFn, URL, { retries: 2, retryDelayMs: 1 })).rejects.toThrow(
      "HTTP 503",
    );
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("does not wait past the timeout budget for a retry", async () => {
    const fetchFn = sequence(502, 200);
    await expect(
      fetchOk(fetchFn, URL, { retries: 2, retryDelayMs: 5000, timeoutMs: 1000 }),
    ).rejects.toThrow("HTTP 502");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("names the label in place of the URL", async () => {
    const fetchFn = sequence(500);
    const message = await fetchOk(fetchFn, "https://example.com/feed?token=secret", {
      label: "price feed",
    }).catch(String);
    expect(message).toContain("HTTP 500 for price feed");
    expect(message).not.toContain("secret");
  });
});
