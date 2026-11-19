// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({
  preloadRoute: vi.fn((_options: unknown) => Promise.resolve(undefined)),
  loadRouteChunk: vi.fn(() => Promise.resolve()),
  routesById: { "/_app/stage_/show": { id: "/_app/stage_/show" } },
}));
vi.mock("@tanstack/react-router", () => ({ useRouter: () => router }));

const { preloadStageShow, usePreloadStageShowCode } = await import("./use-preload-stage-show");
const stageRouter = router as unknown as Parameters<typeof preloadStageShow>[0];

beforeEach(() => {
  router.preloadRoute.mockClear();
  router.loadRouteChunk.mockClear();
});

describe("usePreloadStageShowCode", () => {
  it("loads the show route's code once the page mounts, without its data", () => {
    const { rerender } = renderHook(() => usePreloadStageShowCode());
    rerender();

    expect(router.loadRouteChunk).toHaveBeenCalledOnce();
    expect(router.loadRouteChunk).toHaveBeenCalledWith(router.routesById["/_app/stage_/show"]);
    expect(router.preloadRoute).not.toHaveBeenCalled();
  });
});

describe("preloadStageShow", () => {
  const preloaded = () => router.preloadRoute.mock.calls.map(([options]) => options);

  it("preloads the show from the deck's first card, and the deck page the exit returns to", () => {
    preloadStageShow(stageRouter, { deck: "deck-1" });

    expect(preloaded()).toEqual([
      { to: "/stage/show", search: { deck: "deck-1", i: 0 } },
      { to: "/decks/$deckId", params: { deckId: "deck-1" } },
    ]);
  });
});
