import { PLAYRIFTBOUND_HANDOFF } from "@openrift/shared/playriftbound-sync";
import { describe, expect, it, vi } from "vitest";

import { offerPayload } from "./playriftbound-handoff";

const PAYLOAD = {
  event: { eventId: "117163142476069250", name: "Nexus Night", startsAt: "2026-11-22T13:00:00Z" },
  registrants: [],
  readAt: "2026-11-17T10:00:00Z",
};

function fakeWindow() {
  const posted: unknown[] = [];
  let handler: ((message: unknown) => void) | undefined;
  const stopped = vi.fn();
  return {
    posted,
    stopped,
    send: (message: unknown) => handler?.(message),
    target: {
      post: (message: unknown) => posted.push(message),
      listen: (next: (message: unknown) => void) => {
        handler = next;
        return () => {
          handler = undefined;
          stopped();
        };
      },
    },
  };
}

const OFFER = { type: PLAYRIFTBOUND_HANDOFF.payload, payload: JSON.stringify(PAYLOAD) };

describe("offerPayload", () => {
  it("offers the payload at once and again on every request", () => {
    const page = fakeWindow();
    offerPayload(page.target, PAYLOAD, vi.fn());
    page.send({ type: PLAYRIFTBOUND_HANDOFF.request });
    page.send({ type: "something else" });
    expect(page.posted).toEqual([OFFER, OFFER]);
  });

  it("stops and reports done once the page confirms receipt", () => {
    const page = fakeWindow();
    const done = vi.fn();
    offerPayload(page.target, PAYLOAD, done);
    page.send({ type: PLAYRIFTBOUND_HANDOFF.received });
    page.send({ type: PLAYRIFTBOUND_HANDOFF.request });
    expect(done).toHaveBeenCalledOnce();
    expect(page.stopped).toHaveBeenCalledOnce();
    expect(page.posted).toEqual([OFFER]);
  });
});
