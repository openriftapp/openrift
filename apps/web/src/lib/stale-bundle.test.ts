// @vitest-environment jsdom
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { apiFetch } from "./api-fetch";
import { CHUNK_LOAD_ERROR_PATTERN } from "./error-text";
// Importing ./stale-bundle also installs the reload module's stale notifier,
// exactly like the real entry does.
import { _resetReloadFlagForTesting, initVisibilityVersionCheck } from "./stale-bundle";
import {
  initChunkErrorReloader,
  initVersionStaleNavigationReload,
  isStaleServerFnError,
  reloadIfStaleServerFnError,
  reloadIfUncaughtBareThrow,
} from "./stale-bundle-reload";
import { StaleServerFnError } from "./stale-server-fn-signal";
import { loadSonner } from "./toast";

vi.mock("sonner", () => ({ toast: vi.fn() }));

// COMMIT_HASH is set to "test" by vitest.config's `define`, so build IDs in
// tests either match "test" or use a different literal to force a mismatch.
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
  // jsdom's location.reload is a real function; replace with a spy so we can
  // assert without actually navigating (which would tear down the test env).
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { ...globalThis.location, reload: reloadSpy },
  });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("reload loop guard", () => {
  function dispatchChunkError(): void {
    globalThis.dispatchEvent(
      new ErrorEvent("error", {
        message: "Failed to fetch dynamically imported module: /assets/foo-OLD.js",
      }),
    );
  }

  test("a build id mismatch after a spent chunk-error reload prompts, and the toast still reloads", async () => {
    initChunkErrorReloader();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("ok", { headers: { "X-Build-Id": "deadbeef" } }));

    dispatchChunkError();
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    await apiFetch("/api/v1/cards");
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledTimes(1);
    lastToastAction().onClick();

    expect(reloadSpy).toHaveBeenCalledTimes(2);
  });

  test("a blocked automatic reload falls back to the toast instead of giving up silently", () => {
    initChunkErrorReloader();

    dispatchChunkError();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();

    dispatchChunkError();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledTimes(1);

    lastToastAction().onClick();
    expect(reloadSpy).toHaveBeenCalledTimes(2);
  });

  test("a matching X-Build-Id does not re-arm a reload already spent on this build", async () => {
    initChunkErrorReloader();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("ok", { headers: { "X-Build-Id": "test" } }));

    dispatchChunkError();
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    await apiFetch("/api/v1/cards");
    dispatchChunkError();

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalled();
  });
});

describe("initVersionStaleNavigationReload", () => {
  function fakeRouter(): { subscribe: ReturnType<typeof vi.fn>; navigate: () => void } {
    let resolved: (() => void) | undefined;
    const subscribe = vi.fn((_event: string, callback: () => void) => {
      resolved = callback;
      return () => {};
    });
    return {
      subscribe,
      navigate: () => resolved?.(),
    };
  }

  test("reloads on navigation when the mismatch was detected while the guard was spent", async () => {
    sessionStorage.setItem("openrift:reload-attempted", "test");
    const router = fakeRouter();
    initVersionStaleNavigationReload(router as never);
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("ok", { headers: { "X-Build-Id": "deadbeef" } }));

    await apiFetch("/api/v1/cards");
    expect(reloadSpy).not.toHaveBeenCalled();

    router.navigate();

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledTimes(1);
  });

  test("a mismatch reload is not repeated by the following navigation", async () => {
    const router = fakeRouter();
    initVersionStaleNavigationReload(router as never);
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("ok", { headers: { "X-Build-Id": "deadbeef" } }));

    await apiFetch("/api/v1/cards");
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    router.navigate();

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  test("does not reload on navigation when no new version was detected", () => {
    const router = fakeRouter();
    initVersionStaleNavigationReload(router as never);

    router.navigate();

    expect(reloadSpy).not.toHaveBeenCalled();
  });
});

describe("initChunkErrorReloader", () => {
  test("reloads on dynamic-import failure error event", () => {
    initChunkErrorReloader();

    globalThis.dispatchEvent(
      new ErrorEvent("error", {
        message: "Failed to fetch dynamically imported module: /assets/foo-OLD.js",
      }),
    );

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  test("reloads on chunk-load promise rejection", () => {
    initChunkErrorReloader();

    const event = new Event("unhandledrejection") as Event & { reason: unknown };
    event.reason = new Error("Loading chunk 12 failed");
    globalThis.dispatchEvent(event);

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  test("reloads on Firefox-phrased dynamic-import failure", () => {
    initChunkErrorReloader();

    const event = new Event("unhandledrejection") as Event & { reason: unknown };
    event.reason = new TypeError(
      "error loading dynamically imported module: https://openrift.app/assets/card-detail-BD0IG5-V.js",
    );
    globalThis.dispatchEvent(event);

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  test("ignores unrelated errors", () => {
    initChunkErrorReloader();

    globalThis.dispatchEvent(
      new ErrorEvent("error", { message: "Cannot read property of undefined" }),
    );

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  test("leaves a same-origin bare throw outside render alone: the page still stands", () => {
    initChunkErrorReloader();

    globalThis.dispatchEvent(
      new ErrorEvent("error", {
        message: "uncaught exception: undefined",
        error: undefined,
        filename: `${globalThis.location.origin}/assets/react-dom-C_M-nUen.js`,
        lineno: 8,
      }),
    );

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  test("ignores cross-origin bare throw (browser-extension noise)", () => {
    initChunkErrorReloader();

    globalThis.dispatchEvent(
      new ErrorEvent("error", {
        message: "Script error.",
        error: undefined,
        filename: "",
      }),
    );

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  test("ignores same-origin error with a real Error object", () => {
    initChunkErrorReloader();

    globalThis.dispatchEvent(
      new ErrorEvent("error", {
        message: "TypeError: x is null",
        error: new TypeError("x is null"),
        filename: `${globalThis.location.origin}/assets/foo.js`,
      }),
    );

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  test("leaves a bare promise rejection alone: the page still stands", () => {
    initChunkErrorReloader();

    const event = new Event("unhandledrejection") as Event & { reason: unknown };
    event.reason = undefined;
    globalThis.dispatchEvent(event);

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  test("ignores promise rejection with a real Error", () => {
    initChunkErrorReloader();

    const event = new Event("unhandledrejection") as Event & { reason: unknown };
    event.reason = new Error("normal failure");
    globalThis.dispatchEvent(event);

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  test("reloads on vite:preloadError without preventing the rethrow", () => {
    initChunkErrorReloader();

    const event = new Event("vite:preloadError", { cancelable: true }) as Event & {
      payload: Error;
    };
    event.payload = new Error("Unable to preload CSS for /assets/cards.lazy-OLD.css");
    globalThis.dispatchEvent(event);

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(false);
  });

  test("reloads on vite:preloadError whose payload is undefined", () => {
    initChunkErrorReloader();

    const event = new Event("vite:preloadError", { cancelable: true }) as Event & {
      payload: unknown;
    };
    event.payload = undefined;
    globalThis.dispatchEvent(event);

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  test("vite:preloadError respects the once-per-session loop guard", () => {
    initChunkErrorReloader();

    const makeEvent = (): Event => {
      const event = new Event("vite:preloadError", { cancelable: true }) as Event & {
        payload: Error;
      };
      event.payload = new Error("Failed to fetch dynamically imported module");
      return event;
    };
    globalThis.dispatchEvent(makeEvent());
    globalThis.dispatchEvent(makeEvent());

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledTimes(1);
  });
});

describe("initVisibilityVersionCheck", () => {
  function setVisibility(state: "visible" | "hidden"): void {
    Object.defineProperty(globalThis.document, "visibilityState", {
      configurable: true,
      value: state,
    });
  }

  test("pings /api/health when the tab becomes visible", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    globalThis.fetch = fetchMock;
    initVisibilityVersionCheck();

    setVisibility("visible");
    globalThis.document.dispatchEvent(new Event("visibilitychange"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/health", { cache: "no-store" });
  });

  test("does not ping when the tab becomes hidden", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    globalThis.fetch = fetchMock;
    initVisibilityVersionCheck();

    setVisibility("hidden");
    globalThis.document.dispatchEvent(new Event("visibilitychange"));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("throttles consecutive focus events within the min interval", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    globalThis.fetch = fetchMock;
    initVisibilityVersionCheck();

    setVisibility("visible");
    globalThis.document.dispatchEvent(new Event("visibilitychange"));
    globalThis.document.dispatchEvent(new Event("visibilitychange"));
    globalThis.document.dispatchEvent(new Event("visibilitychange"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("swallows network errors so a backend outage doesn't crash the tab", () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    initVisibilityVersionCheck();

    setVisibility("visible");
    expect(() => {
      globalThis.document.dispatchEvent(new Event("visibilitychange"));
    }).not.toThrow();
  });
});

// Also consumed by sentry-client.ts's `ignoreErrors`, so these real-world
// phrasings must keep matching even if the regex is rewritten.
describe("CHUNK_LOAD_ERROR_PATTERN", () => {
  test.each([
    [
      "Chrome",
      "Failed to fetch dynamically imported module: https://openrift.app/assets/route.lazy-COZEfpB1.js",
    ],
    [
      "Firefox",
      "error loading dynamically imported module: https://openrift.app/assets/card-detail-BsOjEl5_.js",
    ],
    ["Safari", "Importing a module script failed."],
    ["webpack", "ChunkLoadError: Loading chunk 42 failed."],
    ["webpack short form", "Loading chunk 7 failed"],
  ])("matches %s phrasing", (_label, message) => {
    expect(CHUNK_LOAD_ERROR_PATTERN.test(message)).toBe(true);
  });

  test("does not match unrelated TypeErrors", () => {
    expect(CHUNK_LOAD_ERROR_PATTERN.test("Cannot read property of undefined")).toBe(false);
  });
});

describe("reloadIfStaleServerFnError", () => {
  const staleServerFnError = new StaleServerFnError("/_serverFn/abc");

  test("reloads once on the stale-server-fn error and reports it handled", () => {
    expect(reloadIfStaleServerFnError(staleServerFnError)).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  test("ignores an error that only carries Start's missing-function wording", () => {
    expect(reloadIfStaleServerFnError(new Error("Server function info not found for abc"))).toBe(
      false,
    );
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  test("ignores unrelated errors, reports unhandled", () => {
    expect(reloadIfStaleServerFnError(new Error("Collection not found"))).toBe(false);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  test("respects the loop guard on repeated stale calls", () => {
    reloadIfStaleServerFnError(staleServerFnError);
    reloadIfStaleServerFnError(staleServerFnError);
    reloadIfStaleServerFnError(staleServerFnError);

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledTimes(1);
  });

  test("isStaleServerFnError narrows on the error's name without reloading", () => {
    expect(isStaleServerFnError(staleServerFnError)).toBe(true);
    expect(isStaleServerFnError(new Error("network down"))).toBe(false);
    expect(isStaleServerFnError(undefined)).toBe(false);
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});

describe("reloadIfUncaughtBareThrow", () => {
  test.each([
    ["undefined", undefined],
    ["null", null],
    ["empty string", ""],
  ])("reloads once on a bare throw of %s and reports it handled", (_label, thrown) => {
    expect(reloadIfUncaughtBareThrow(thrown)).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  test("leaves real Errors alone — no reload, reports unhandled", () => {
    expect(reloadIfUncaughtBareThrow(new TypeError("x is null"))).toBe(false);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  test("leaves non-empty thrown strings alone", () => {
    expect(reloadIfUncaughtBareThrow("NOT_FOUND")).toBe(false);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  test("respects the once-per-session loop guard", () => {
    reloadIfUncaughtBareThrow(undefined);
    reloadIfUncaughtBareThrow(undefined);

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledTimes(1);
  });
});
