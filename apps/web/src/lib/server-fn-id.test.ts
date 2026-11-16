import { describe, expect, it } from "vitest";

import { serverFnId, serverFnNameFromPath } from "./server-fn-id";

const DIGEST = "c0846484".repeat(8);

describe("serverFnId", () => {
  it("leads with the function name and keeps a short digest", () => {
    expect(serverFnId("fetchCatalog_createServerFn_handler", DIGEST)).toBe(
      "fetchCatalog.c0846484c0846484",
    );
  });
});

describe("serverFnNameFromPath", () => {
  it("reads the name back from a request path", () => {
    expect(serverFnNameFromPath("/_serverFn/fetchCatalog.c0846484c0846484")).toBe("fetchCatalog");
    expect(serverFnNameFromPath("/_serverFn/fetchCatalog.c0846484c0846484_1")).toBe("fetchCatalog");
  });

  it("ignores any other path", () => {
    expect(serverFnNameFromPath(`/_serverFn/${DIGEST}`)).toBeUndefined();
    expect(serverFnNameFromPath("/_serverFn/not-a-real-id")).toBeUndefined();
    expect(serverFnNameFromPath("/cards/fetchCatalog.c0846484c0846484")).toBeUndefined();
  });
});
