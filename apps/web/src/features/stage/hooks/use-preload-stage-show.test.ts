// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({
  preloadRoute: vi.fn(() => Promise.resolve(undefined)),
  loadRouteChunk: vi.fn(() => Promise.resolve()),
  routesById: { "/_app/stage_/show": { id: "/_app/stage_/show" } },
}));
vi.mock("@tanstack/react-router", () => ({ useRouter: () => router }));

const { preloadStageShow, usePreloadStageShowCode } = await import("./use-preload-stage-show");

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
  it("preloads the show for a deck from its first card", () => {
    preloadStageShow(router, { deck: "deck-1" });

    expect(router.preloadRoute).toHaveBeenCalledWith({
      to: "/stage/show",
      search: { deck: "deck-1", i: 0 },
    });
  });
});
