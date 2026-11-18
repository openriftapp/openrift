// @vitest-environment jsdom
import { API_FORMAT_VERSION } from "@openrift/shared/contracts/api-format";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { apiFetch } from "./api-fetch";
// Importing ./stale-bundle installs the reload module's stale notifier, like the real entry does.
import { _resetReloadFlagForTesting } from "./stale-bundle";
import { initChunkErrorReloader } from "./stale-bundle-reload";
import { loadSonner } from "./toast";

vi.mock("sonner", () => ({ toast: vi.fn() }));

// COMMIT_HASH is "test" (vitest.config `define`), so "deadbeef" is a different build.
const originalFetch = globalThis.fetch;
const reloadSpy = vi.fn();

function lastToastAction(): { label: string; onClick: () => void } {
  const lastCall = vi.mocked(toast).mock.calls.at(-1);
  if (!lastCall) {
    throw new Error("toast was never called");
  }
  const options = lastCall[1] as { action?: { label: string; onClick: () => void } };
  if (!options?.action) {
    throw new Error("toast was called without an action");
  }
  return options.action;
}

beforeEach(async () => {
  await loadSonner();
  _resetReloadFlagForTesting();
  reloadSpy.mockReset();
  vi.mocked(toast).mockClear();
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { ...globalThis.location, reload: reloadSpy },
  });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("apiFetch build id check", () => {
  test("reloads once when X-Build-Id differs", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("ok", { headers: { "X-Build-Id": "deadbeef" } }));

    await apiFetch("/api/v1/cards");

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();
  });

  test("a mismatch after the automatic reload was spent prompts instead of reloading again", async () => {
    sessionStorage.setItem("openrift:reload-attempted", "test");
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("ok", { headers: { "X-Build-Id": "deadbeef" } }));

    await apiFetch("/api/v1/cards");

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledTimes(1);
    lastToastAction().onClick();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  test("does not prompt when X-Build-Id matches", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("ok", { headers: { "X-Build-Id": "test" } }));

    await apiFetch("/api/v1/cards");

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  test("ignores responses without X-Build-Id", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("ok"));

    await apiFetch("/api/v1/cards");

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  test("ignores a mismatched X-Build-Id on a cacheable response (browser-cache replay)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("ok", {
        headers: {
          "X-Build-Id": "deadbeef",
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      }),
    );

    await apiFetch("/api/v1/catalog");

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  test("a matching X-Build-Id on a cacheable response does not confirm the bundle", async () => {
    vi.useFakeTimers();
    try {
      initChunkErrorReloader();
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response("ok", {
          headers: { "X-Build-Id": "test", "Cache-Control": "public, max-age=3600" },
        }),
      );

      globalThis.dispatchEvent(
        new ErrorEvent("error", {
          message: "Failed to fetch dynamically imported module: /assets/foo-OLD.js",
        }),
      );
      expect(reloadSpy).toHaveBeenCalledTimes(1);

      await apiFetch("/api/v1/catalog");
      vi.advanceTimersByTime(10_000);

      globalThis.dispatchEvent(
        new ErrorEvent("error", {
          message: "Failed to fetch dynamically imported module: /assets/foo-OLD.js",
        }),
      );
      expect(reloadSpy).toHaveBeenCalledTimes(1);
      expect(toast).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  test("reloads only once even on repeated mismatches", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("ok", { headers: { "X-Build-Id": "deadbeef" } }));

    await apiFetch("/api/v1/cards");
    await apiFetch("/api/v1/cards");
    await apiFetch("/api/v1/cards");

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();
  });
});

describe("apiFetch API format check", () => {
  function formatResponse(format: number | string, body = "cached"): Response {
    return new Response(body, { headers: { "X-Api-Format": String(format) } });
  }

  test("does nothing when the format matches", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(formatResponse(API_FORMAT_VERSION));
    globalThis.fetch = fetchSpy;

    const response = await apiFetch("/api/v1/catalog");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(await response.text()).toBe("cached");
    expect(toast).not.toHaveBeenCalled();
  });

  test("transparently refetches an older-format body with cache: no-store", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(formatResponse(API_FORMAT_VERSION - 1, "stale"))
      .mockResolvedValueOnce(formatResponse(API_FORMAT_VERSION, "fresh"));
    globalThis.fetch = fetchSpy;

    const response = await apiFetch("/api/v1/catalog");

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenLastCalledWith("/api/v1/catalog", { cache: "no-store" });
    expect(await response.text()).toBe("fresh");
    expect(toast).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  test("does not refetch when the request already bypassed caches", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(formatResponse(API_FORMAT_VERSION - 1, "stale"));
    globalThis.fetch = fetchSpy;

    const response = await apiFetch("/api/v1/catalog", { cache: "no-store" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(await response.text()).toBe("stale");
  });

  test("does not refetch non-GET requests", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(formatResponse(API_FORMAT_VERSION - 1));
    globalThis.fetch = fetchSpy;

    await apiFetch("/api/v1/catalog", { method: "POST" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test("reloads once when the body format is newer than the bundle", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(formatResponse(API_FORMAT_VERSION + 1));

    await apiFetch("/api/v1/catalog");

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();
  });

  test("refetches an older-format body for an oRPC Request and cancels the discarded body", async () => {
    const stale = formatResponse(API_FORMAT_VERSION - 1, "stale");
    const cancel = vi.spyOn(stale.body!, "cancel");
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(stale)
      .mockResolvedValueOnce(formatResponse(API_FORMAT_VERSION, "fresh"));
    globalThis.fetch = fetchSpy;
    const request = new Request("https://openrift.test/api/v1/prices");

    const response = await apiFetch(request, {});

    expect(fetchSpy).toHaveBeenLastCalledWith(request, { cache: "no-store" });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(await response.text()).toBe("fresh");
  });

  test("does not refetch a Request that already bypassed caches", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(formatResponse(API_FORMAT_VERSION - 1));
    globalThis.fetch = fetchSpy;

    await apiFetch(new Request("https://openrift.test/api/v1/prices", { cache: "no-store" }));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test("ignores a malformed format header", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(formatResponse("not-a-number"));
    globalThis.fetch = fetchSpy;

    await apiFetch("/api/v1/catalog");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();
  });
});
