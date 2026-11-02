import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  closeOverlayHistoryEntry,
  hasOverlayHistoryEntry,
  useOverlayHistoryEntry,
} from "./use-overlay-history-entry";

const navigateMock = vi.fn();
// Must stay one stable object: the hook keys its effect on router identity.
const routerStub = {
  navigate: navigateMock,
  latestLocation: { href: "/decks/share/abc?view=grid" },
};
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => routerStub,
}));

function deferred() {
  let finish = () => {};
  // oxlint-disable-next-line promise/avoid-new -- a navigation the test finishes by hand
  const promise = new Promise<void>((resolve) => {
    finish = () => resolve();
  });
  return { promise, resolve: finish };
}

beforeEach(() => {
  navigateMock.mockReset();
  history.replaceState(null, "");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useOverlayHistoryEntry", () => {
  it("pushes an entry flagged with the overlay's key and as an overlay entry", () => {
    renderHook(() =>
      useOverlayHistoryEntry({ active: true, stateKey: "cardDetail", onPop: vi.fn() }),
    );

    expect(navigateMock).toHaveBeenCalledTimes(1);
    const options = navigateMock.mock.calls[0]?.[0];
    expect(options.href).toBe("/decks/share/abc?view=grid");
    expect(options.state({ __TSR_index: 0 })).toEqual({
      __TSR_index: 0,
      cardDetail: expect.any(Number),
      overlayEntry: true,
    });
  });

  it("passes resetScroll: false so opening the overlay does not jump the page to the top", () => {
    renderHook(() =>
      useOverlayHistoryEntry({ active: true, stateKey: "cardDetail", onPop: vi.fn() }),
    );

    expect(navigateMock).toHaveBeenCalledWith(expect.objectContaining({ resetScroll: false }));
  });

  it("pushes nothing while inactive", () => {
    const onPop = vi.fn();
    renderHook(() => useOverlayHistoryEntry({ active: false, stateKey: "cardDetail", onPop }));

    globalThis.dispatchEvent(new PopStateEvent("popstate"));

    expect(navigateMock).not.toHaveBeenCalled();
    expect(onPop).not.toHaveBeenCalled();
  });

  it("runs onPop when the entry is popped", () => {
    const onPop = vi.fn();
    renderHook(() => useOverlayHistoryEntry({ active: true, stateKey: "cardDetail", onPop }));

    globalThis.dispatchEvent(new PopStateEvent("popstate"));

    expect(onPop).toHaveBeenCalledTimes(1);
  });

  it("stays open when the pop only closed an overlay stacked above it", () => {
    const onPop = vi.fn();
    renderHook(() => useOverlayHistoryEntry({ active: true, stateKey: "cardDetail", onPop }));
    const ownState = navigateMock.mock.calls[0]?.[0].state({});
    history.replaceState(ownState, "");

    globalThis.dispatchEvent(new PopStateEvent("popstate"));

    expect(onPop).not.toHaveBeenCalled();
  });

  it("closes when the pop lands on an entry another overlay left its key on", () => {
    const onPop = vi.fn();
    history.replaceState({ cardDetail: 1, overlayEntry: true }, "");
    renderHook(() => useOverlayHistoryEntry({ active: true, stateKey: "cardDetail", onPop }));
    const ownState = navigateMock.mock.calls[0]?.[0].state(history.state);
    expect(ownState.cardDetail).not.toBe(history.state.cardDetail);

    globalThis.dispatchEvent(new PopStateEvent("popstate"));

    expect(onPop).toHaveBeenCalledTimes(1);
  });

  it("uses the newest onPop without pushing a second entry", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ onPop }: { onPop: () => void }) =>
        useOverlayHistoryEntry({ active: true, stateKey: "cardDetail", onPop }),
      { initialProps: { onPop: first } },
    );

    rerender({ onPop: second });
    globalThis.dispatchEvent(new PopStateEvent("popstate"));

    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("stops listening once unmounted", () => {
    const onPop = vi.fn();
    const { unmount } = renderHook(() =>
      useOverlayHistoryEntry({ active: true, stateKey: "cardDetail", onPop }),
    );

    unmount();
    globalThis.dispatchEvent(new PopStateEvent("popstate"));

    expect(onPop).not.toHaveBeenCalled();
  });

  it("waits for an overlay's entry to land before pushing the next one", async () => {
    const firstNavigation = deferred();
    navigateMock.mockImplementationOnce(() => firstNavigation.promise);
    renderHook(() =>
      useOverlayHistoryEntry({ active: true, stateKey: "cardDetail", onPop: vi.fn() }),
    );
    renderHook(() =>
      useOverlayHistoryEntry({ active: true, stateKey: "printingLightbox", onPop: vi.fn() }),
    );

    expect(navigateMock).toHaveBeenCalledTimes(1);

    firstNavigation.resolve();
    await vi.waitFor(() => expect(navigateMock).toHaveBeenCalledTimes(2));
    expect(navigateMock.mock.calls[1]?.[0].state({})).toHaveProperty("printingLightbox");
  });

  it("drops a queued entry when its overlay closed before the push", async () => {
    const firstNavigation = deferred();
    navigateMock.mockImplementationOnce(() => firstNavigation.promise);
    renderHook(() =>
      useOverlayHistoryEntry({ active: true, stateKey: "cardDetail", onPop: vi.fn() }),
    );
    const { unmount } = renderHook(() =>
      useOverlayHistoryEntry({ active: true, stateKey: "printingLightbox", onPop: vi.fn() }),
    );

    unmount();
    firstNavigation.resolve();
    await firstNavigation.promise;
    await Promise.resolve();

    expect(navigateMock).toHaveBeenCalledTimes(1);
  });

  it("keeps two overlays on one page apart", () => {
    const onPop = vi.fn();
    renderHook(() =>
      useOverlayHistoryEntry({ active: true, stateKey: "missingCardDetail", onPop }),
    );

    const options = navigateMock.mock.calls[0]?.[0];
    expect(options.state({ __TSR_index: 0 })).toEqual({
      __TSR_index: 0,
      missingCardDetail: expect.any(Number),
      overlayEntry: true,
    });
  });
});

describe("closeOverlayHistoryEntry", () => {
  it("pops the pushed entry instead of leaving it behind", () => {
    const back = vi.spyOn(history, "back").mockImplementation(() => {});
    const close = vi.fn();
    history.pushState({ cardDetail: true }, "");

    closeOverlayHistoryEntry("cardDetail", close);

    expect(back).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it("closes directly when the entry is not there", () => {
    const back = vi.spyOn(history, "back").mockImplementation(() => {});
    const close = vi.fn();

    closeOverlayHistoryEntry("cardDetail", close);

    expect(back).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("runs afterClose only once the pop has landed", () => {
    vi.spyOn(history, "back").mockImplementation(() => {});
    const afterClose = vi.fn();
    history.pushState({ cardDetail: true }, "");

    closeOverlayHistoryEntry("cardDetail", vi.fn(), afterClose);
    expect(afterClose).not.toHaveBeenCalled();

    globalThis.dispatchEvent(new PopStateEvent("popstate"));
    globalThis.dispatchEvent(new PopStateEvent("popstate"));
    expect(afterClose).toHaveBeenCalledTimes(1);
  });

  it("runs afterClose right after a direct close", () => {
    const close = vi.fn();
    const afterClose = vi.fn();

    closeOverlayHistoryEntry("cardDetail", close, afterClose);

    expect(close).toHaveBeenCalledTimes(1);
    expect(afterClose).toHaveBeenCalledTimes(1);
  });

  it("ignores another overlay's entry", () => {
    const back = vi.spyOn(history, "back").mockImplementation(() => {});
    const close = vi.fn();
    history.pushState({ missingCardDetail: true }, "");

    closeOverlayHistoryEntry("cardDetail", close);

    expect(back).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe("hasOverlayHistoryEntry", () => {
  it("reports the flag on the top entry", () => {
    history.pushState({ cardDetail: true }, "");

    expect(hasOverlayHistoryEntry("cardDetail")).toBe(true);
    expect(hasOverlayHistoryEntry("missingCardDetail")).toBe(false);
  });

  it("is false with no state at all", () => {
    expect(hasOverlayHistoryEntry("cardDetail")).toBe(false);
  });
});
