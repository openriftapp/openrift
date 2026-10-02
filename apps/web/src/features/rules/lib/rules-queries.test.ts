import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const chain = {
      handler: (fn: (...args: unknown[]) => unknown) => fn,
      middleware: () => chain,
      validator: () => chain,
    };
    return chain;
  },
  createMiddleware: () => {
    const chain = {
      server: () => chain,
      client: () => chain,
    };
    return chain;
  },
}));

vi.mock("@/lib/server-cache", async () => {
  const { QueryClient: QC } = await import("@tanstack/react-query");
  return { serverCache: new QC({ defaultOptions: { queries: { retry: false } } }) };
});

const { rulesAtVersionQueryOptions, rulesSourceQueryOptions, ruleVersionsQueryOptions } =
  await import("./rules-queries");

describe("rulesAtVersionQueryOptions", () => {
  it("scopes the query key by kind, language and version", () => {
    expect(rulesAtVersionQueryOptions("core", "en", "1.0.0").queryKey).toEqual([
      "rules",
      "core",
      "en",
      "1.0.0",
    ]);
    expect(rulesAtVersionQueryOptions("tournament", "en", "1.0.0").queryKey).toEqual([
      "rules",
      "tournament",
      "en",
      "1.0.0",
    ]);
    expect(rulesAtVersionQueryOptions("core", "fr", "1.0.0").queryKey).toEqual([
      "rules",
      "core",
      "fr",
      "1.0.0",
    ]);
  });
});

describe("rulesSourceQueryOptions", () => {
  it("scopes the query key by language", () => {
    expect(rulesSourceQueryOptions("core", "ko", "1.0.0").queryKey).toEqual([
      "rules",
      "core",
      "ko",
      "1.0.0",
      "source",
    ]);
  });
});

describe("ruleVersionsQueryOptions", () => {
  it("scopes the query key by kind and language", () => {
    expect(ruleVersionsQueryOptions("core", "fr").queryKey).toEqual([
      "rules",
      "core",
      "fr",
      "versions",
    ]);
    expect(ruleVersionsQueryOptions("tournament", "en").queryKey).toEqual([
      "rules",
      "tournament",
      "en",
      "versions",
    ]);
  });

  it("defaults to English", () => {
    expect(ruleVersionsQueryOptions("core").queryKey).toEqual(["rules", "core", "en", "versions"]);
  });
});

describe("query cache isolation", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    client.clear();
  });

  it("treats kinds and languages as independent caches", () => {
    const page = { kind: "core" as const, language: "en" as const, version: "1.0.0", rules: [] };
    client.setQueryData(rulesAtVersionQueryOptions("core", "en", "1.0.0").queryKey, page);
    expect(
      client.getQueryData(rulesAtVersionQueryOptions("tournament", "en", "1.0.0").queryKey),
    ).toBeUndefined();
    expect(
      client.getQueryData(rulesAtVersionQueryOptions("core", "fr", "1.0.0").queryKey),
    ).toBeUndefined();
    expect(client.getQueryData(rulesAtVersionQueryOptions("core", "en", "1.0.0").queryKey)).toEqual(
      page,
    );
  });
});
