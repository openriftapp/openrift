import { PLAYRIFTBOUND_HANDOFF } from "@openrift/shared/playriftbound-sync";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePlayriftboundHandoff } from "./use-playriftbound-handoff";

const PAYLOAD = {
  event: {
    eventId: "117163142476069250",
    name: "Summoner Skirmish",
    startsAt: "2026-11-22T13:00:00Z",
  },
  registrants: [
    { playerId: "p1", displayName: "Poro Snax", tagLine: "EUW", dropped: false, deck: null },
  ],
  readAt: "2026-11-17T10:00:00Z",
};

function deliver(data: unknown, source: MessageEventSource | null = globalThis.window) {
  act(() => {
    globalThis.dispatchEvent(
      new MessageEvent("message", { data, origin: globalThis.location.origin, source }),
    );
  });
}

describe("usePlayriftboundHandoff", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("asks the extension for the event on mount", () => {
    const post = vi.spyOn(globalThis, "postMessage");
    renderHook(() => usePlayriftboundHandoff());
    expect(post).toHaveBeenCalledWith(
      { type: PLAYRIFTBOUND_HANDOFF.request },
      globalThis.location.origin,
    );
  });

  it("takes a valid payload and confirms it", () => {
    const post = vi.spyOn(globalThis, "postMessage");
    const { result } = renderHook(() => usePlayriftboundHandoff());
    deliver({ type: PLAYRIFTBOUND_HANDOFF.payload, payload: JSON.stringify(PAYLOAD) });
    expect(result.current).toEqual(PAYLOAD);
    expect(post).toHaveBeenLastCalledWith(
      { type: PLAYRIFTBOUND_HANDOFF.received },
      globalThis.location.origin,
    );
  });

  it("ignores messages that are malformed, of another type or from another window", () => {
    const { result } = renderHook(() => usePlayriftboundHandoff());
    deliver({ type: PLAYRIFTBOUND_HANDOFF.payload, payload: "{not json" });
    deliver({ type: PLAYRIFTBOUND_HANDOFF.payload, payload: JSON.stringify({ event: {} }) });
    deliver({ type: "other", payload: JSON.stringify(PAYLOAD) });
    deliver({ type: PLAYRIFTBOUND_HANDOFF.payload, payload: JSON.stringify(PAYLOAD) }, null);
    expect(result.current).toBeUndefined();
  });
});
