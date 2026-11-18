import type { Active, Over } from "@dnd-kit/core";
import { describe, expect, it } from "vitest";

import { stubPrinting } from "@/test/factories";

import { stageDragAnnouncements } from "./stage-drag-announcements";

function active(id: string, data: Record<string, unknown>): Active {
  return { id, data: { current: data }, rect: { current: { initial: null, translated: null } } };
}

function over(id: string, data: Record<string, unknown>): Over {
  return {
    id,
    data: { current: data },
    rect: { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 },
    disabled: false,
  };
}

const poolCard = active("pool-1", {
  type: "stage-pool-card",
  printing: stubPrinting({ card: { name: "Annie, Fiery" } }),
});

describe("stageDragAnnouncements", () => {
  it("names a browser card and where it joins the queue", () => {
    expect(stageDragAnnouncements.onDragStart({ active: poolCard })).toBe(
      "Picked up Annie, Fiery.",
    );
    expect(
      stageDragAnnouncements.onDragOver?.({
        active: poolCard,
        over: over("slot-1", { type: "stage-queue-slot", index: 1, name: "Lux, Illuminated" }),
      }),
    ).toBe("Annie, Fiery is over the queue before Lux, Illuminated.");
    expect(
      stageDragAnnouncements.onDragEnd({
        active: poolCard,
        over: over("queue", { type: "stage-queue" }),
      }),
    ).toBe("Dropped Annie, Fiery on the queue.");
  });

  it("names a queued stop and the stop it moves over", () => {
    const stop = active("row-0", { type: "stage-queue-row", index: 0, name: "Lux, Illuminated" });
    expect(
      stageDragAnnouncements.onDragEnd({
        active: stop,
        over: over("row-2", { type: "stage-queue-row", index: 2, name: "Jinx, Loose Cannon" }),
      }),
    ).toBe("Dropped Lux, Illuminated on Jinx, Loose Cannon.");
    expect(
      stageDragAnnouncements.onDragEnd({
        active: stop,
        over: over("queue", { type: "stage-queue" }),
      }),
    ).toBe("Dropped Lux, Illuminated. Nothing moved.");
  });
});
