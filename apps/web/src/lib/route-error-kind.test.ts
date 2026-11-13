import { describe, expect, it } from "vitest";

import { isNetworkError } from "./error-text";
import { needsFullReload, routeErrorKind } from "./route-error-kind";

function statusError(status: number): Error {
  return Object.assign(new Error("request failed"), { status });
}

describe("isNetworkError", () => {
  it.each(["Failed to fetch", "Load failed", "NetworkError when attempting to fetch resource."])(
    "matches the browser fetch failure %s",
    (message) => {
      expect(isNetworkError(new TypeError(message))).toBe(true);
    },
  );

  it("matches a fetch failure that lost its prototype", () => {
    expect(isNetworkError({ message: "Failed to fetch" })).toBe(true);
  });

  it("matches a fetch failure wrapped as a cause", () => {
    const error = new Error("loader failed", { cause: new TypeError("Load failed") });
    expect(isNetworkError(error)).toBe(true);
  });

  it("does not match a render TypeError", () => {
    expect(isNetworkError(new TypeError("Cannot read properties of undefined"))).toBe(false);
  });

  it("does not match a chunk load failure", () => {
    const error = new TypeError("Failed to fetch dynamically imported module: /a.js");
    expect(isNetworkError(error)).toBe(false);
  });

  it("does not match the server-side fetch failure", () => {
    expect(isNetworkError(new TypeError("fetch failed"))).toBe(false);
  });
});

describe("routeErrorKind", () => {
  it("is offline when the browser reports offline", () => {
    expect(routeErrorKind(statusError(500), false)).toBe("offline");
  });

  it("is offline for a network failure while online", () => {
    expect(routeErrorKind(new TypeError("Failed to fetch"), true)).toBe("offline");
  });

  it.each([401, 403])("is forbidden for status %i", (status) => {
    expect(routeErrorKind(statusError(status), true)).toBe("forbidden");
  });

  it.each([
    ["a 500", statusError(500)],
    ["a 504", statusError(504)],
    ["a render error", new Error("boom")],
    ["a thrown string", "boom"],
    ["undefined", undefined],
  ])("is failed for %s", (_label, error) => {
    expect(routeErrorKind(error, true)).toBe("failed");
  });
});

describe("needsFullReload", () => {
  it("is true for a chunk load failure, also as a cause", () => {
    const chunk = new TypeError("Failed to fetch dynamically imported module: /a.js");
    expect(needsFullReload(chunk)).toBe(true);
    expect(needsFullReload(new Error("render failed", { cause: chunk }))).toBe(true);
  });

  it("is true for a stale server function", () => {
    expect(needsFullReload(new Error("Server function info not found for abc"))).toBe(true);
  });

  it("is false for other errors", () => {
    expect(needsFullReload(new TypeError("Failed to fetch"))).toBe(false);
    expect(needsFullReload(statusError(500))).toBe(false);
  });
});
