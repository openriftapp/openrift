// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  _resetReloadStateForTesting,
  forceReload,
  isStaleServerFnError,
  markNewVersionAvailable,
  reloadIfChunkLoadError,
  reloadIfStaleServerFnError,
  reloadIfUncaughtBareThrow,
  setStaleNotifier,
} from "./stale-bundle-reload";
import { StaleServerFnError } from "./stale-server-fn-signal";

const reloadSpy = vi.fn();
const notifierSpy = vi.fn();

beforeEach(() => {
  _resetReloadStateForTesting();
  reloadSpy.mockReset();
  notifierSpy.mockReset();
  setStaleNotifier(notifierSpy);
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { ...globalThis.location, reload: reloadSpy },
  });
});

afterEach(() => {
  vi.useRealTimers();
  _resetReloadStateForTesting();
});

describe("markNewVersionAvailable", () => {
  it("returns true and flips the flag the first time it is called", () => {
    expect(markNewVersionAvailable()).toBe(true);
  });

  it("is idempotent: a second call returns false without re-flipping", () => {
    expect(markNewVersionAvailable()).toBe(true);
    expect(markNewVersionAvailable()).toBe(false);
    expect(markNewVersionAvailable()).toBe(false);
  });

  it("returns true again after the module state is reset (test-only escape hatch)", () => {
    expect(markNewVersionAvailable()).toBe(true);
    _resetReloadStateForTesting();
    expect(markNewVersionAvailable()).toBe(true);
  });
});

describe("reload loop guard (driven via reloadIfUncaughtBareThrow)", () => {
  it("reloads automatically on the first blocked event", () => {
    expect(reloadIfUncaughtBareThrow(undefined)).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(notifierSpy).not.toHaveBeenCalled();
  });

  it("falls back to the notifier once the automatic reload has been spent", () => {
    reloadIfUncaughtBareThrow(undefined);
    reloadIfUncaughtBareThrow(null);

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(notifierSpy).toHaveBeenCalledTimes(1);
  });

  it("reports false and does nothing for a non-bare error", () => {
    expect(reloadIfUncaughtBareThrow(new Error("real bug"))).toBe(false);
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(notifierSpy).not.toHaveBeenCalled();
  });
});

describe("reload loop guard across builds", () => {
  it("records the build the reload left from", () => {
    reloadIfUncaughtBareThrow(undefined);

    expect(sessionStorage.getItem("openrift:reload-attempted")).toBe("test");
  });

  it("reloads again once the page runs another build than the last reload left from", () => {
    sessionStorage.setItem("openrift:reload-attempted", "an-older-build");

    expect(reloadIfUncaughtBareThrow(undefined)).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(notifierSpy).not.toHaveBeenCalled();
  });

  it("prompts on a page still running the build the last reload left from", () => {
    sessionStorage.setItem("openrift:reload-attempted", "test");

    reloadIfUncaughtBareThrow(undefined);

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(notifierSpy).toHaveBeenCalledTimes(1);
  });
});

describe("forceReload", () => {
  it("always reloads, bypassing the loop guard entirely", () => {
    reloadIfUncaughtBareThrow(undefined);
    reloadIfUncaughtBareThrow(undefined);

    forceReload("user clicked reload");

    expect(reloadSpy).toHaveBeenCalledTimes(2);
  });
});

describe("isStaleServerFnError / reloadIfStaleServerFnError", () => {
  it("matches the error serverFnFetch throws for the stale signal", () => {
    expect(isStaleServerFnError(new StaleServerFnError("/_serverFn/abc"))).toBe(true);
  });

  it("does not match Start's missing-function wording on its own", () => {
    expect(isStaleServerFnError(new Error("Server function info not found for deadbeef"))).toBe(
      false,
    );
  });

  it("returns false for unrelated errors, strings, and undefined", () => {
    expect(isStaleServerFnError(new Error("Collection not found"))).toBe(false);
    expect(isStaleServerFnError("plain string")).toBe(false);
    expect(isStaleServerFnError(undefined)).toBe(false);
    expect(isStaleServerFnError({})).toBe(false);
  });

  it("reloads once and reports handled for a stale server-fn error", () => {
    expect(reloadIfStaleServerFnError(new StaleServerFnError("/_serverFn/abc"))).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("reports unhandled and does not reload for unrelated errors", () => {
    expect(reloadIfStaleServerFnError(new Error("network down"))).toBe(false);
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});

describe("reloadIfChunkLoadError", () => {
  it("reloads for a chunk-load error React wrapped as the cause of its recovery error", () => {
    const chunkError = new TypeError(
      "Failed to fetch dynamically imported module: https://example.test/assets/_app-abc.js",
    );
    const wrapper = new Error("There was an error during concurrent rendering", {
      cause: chunkError,
    });

    expect(reloadIfChunkLoadError(wrapper)).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("reloads for an unwrapped chunk-load error", () => {
    expect(reloadIfChunkLoadError(new Error("Importing a module script failed."))).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("falls back to the notifier once the automatic reload has been spent", () => {
    const chunkError = new TypeError("Failed to fetch dynamically imported module: x");
    reloadIfChunkLoadError(chunkError);

    expect(reloadIfChunkLoadError(chunkError)).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(notifierSpy).toHaveBeenCalledTimes(1);
  });

  it("returns false for a wrapper whose cause is an unrelated error", () => {
    const wrapper = new Error("There was an error during concurrent rendering", {
      cause: new Error("real bug"),
    });

    expect(reloadIfChunkLoadError(wrapper)).toBe(false);
    expect(reloadIfChunkLoadError(undefined)).toBe(false);
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
