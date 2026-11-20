import { afterEach, describe, expect, it, vi } from "vitest";

import { isTrustedServerFnOrigin } from "./csrf-origin";

const proxiedRequest = new Request("http://openrift.app/_serverFn/fetchMetaDeckCards");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isTrustedServerFnOrigin", () => {
  it("accepts the public https origin when the proxy forwards the request as http", () => {
    vi.stubEnv("SITE_URL", "https://openrift.app");

    expect(isTrustedServerFnOrigin("https://openrift.app", proxiedRequest)).toBe(true);
  });

  it("accepts the request's own origin", () => {
    vi.stubEnv("SITE_URL", "https://openrift.app");
    const request = new Request("http://localhost:5174/_serverFn/fetchCatalogVersion");

    expect(isTrustedServerFnOrigin("http://localhost:5174", request)).toBe(true);
  });

  it.each([
    "https://evil.example",
    "https://openrift.app.evil.example",
    "https://preview.openrift.app",
  ])("rejects %s", (origin) => {
    vi.stubEnv("SITE_URL", "https://openrift.app");

    expect(isTrustedServerFnOrigin(origin, proxiedRequest)).toBe(false);
  });
});
