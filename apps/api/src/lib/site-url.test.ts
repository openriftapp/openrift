import { describe, expect, it } from "vitest";

import { shareUrlFromOrigin, siteHostFromOrigin } from "./site-url.js";

describe("siteHostFromOrigin", () => {
  it("returns the host of the origin", () => {
    expect(siteHostFromOrigin("https://openrift.test")).toBe("openrift.test");
  });

  it("keeps a non-default port", () => {
    expect(siteHostFromOrigin("http://localhost:5173")).toBe("localhost:5173");
  });

  it("returns undefined without an origin", () => {
    expect(siteHostFromOrigin()).toBeUndefined();
    expect(siteHostFromOrigin("")).toBeUndefined();
  });

  it("returns undefined for an unparseable origin", () => {
    expect(siteHostFromOrigin("not a url")).toBeUndefined();
  });
});

describe("shareUrlFromOrigin", () => {
  it("appends the path to the origin", () => {
    expect(shareUrlFromOrigin("https://openrift.test", "/lists/share/abc")).toBe(
      "https://openrift.test/lists/share/abc",
    );
  });

  it("returns undefined without an origin", () => {
    expect(shareUrlFromOrigin(undefined, "/lists/share/abc")).toBeUndefined();
    expect(shareUrlFromOrigin("", "/lists/share/abc")).toBeUndefined();
  });
});
