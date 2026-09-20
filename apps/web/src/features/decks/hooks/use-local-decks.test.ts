// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { liveQueryConfigs } = vi.hoisted(() => ({
  liveQueryConfigs: [] as { query: (q: unknown) => unknown }[],
}));

vi.mock("@tanstack/react-db", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useLiveQuery: (config: { query: (q: unknown) => unknown }) => {
    liveQueryConfigs.push(config);
    return { data: [] };
  },
}));

const { useIsLocalDeck } = await import("./use-local-decks");

const DECK_ID = "0190aaaa-0000-7000-8000-000000000001";

describe("the local deck hooks during SSR", () => {
  const builder = { from: vi.fn() };

  beforeEach(() => {
    builder.from.mockReset().mockReturnValue({ where: () => "live-query" });
    liveQueryConfigs.length = 0;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function capturedQuery(): (q: unknown) => unknown {
    // oxlint-disable-next-line react-hooks/rules-of-hooks -- useLiveQuery is mocked; nothing renders
    useIsLocalDeck(DECK_ID);
    const config = liveQueryConfigs.at(-1);
    if (!config) {
      throw new Error("useLiveQuery was not called");
    }
    return config.query;
  }

  it("runs no live query without a window", () => {
    vi.stubGlobal("window", undefined);

    expect(capturedQuery()(builder)).toBeNull();
    expect(builder.from).not.toHaveBeenCalled();
  });

  it("reads the local store in the browser", () => {
    expect(capturedQuery()(builder)).toBe("live-query");
  });
});
