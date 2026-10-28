import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Transact } from "../../../deps.js";
import { removeMetaEvent, unpublishMetaEvent } from "./meta-remove.js";

const meta = { sourcesForEvent: vi.fn(), deleteEvent: vi.fn(), eventById: vi.fn() };
const metaOverlays = { ignoreEvent: vi.fn() };
const transact = ((fn: (repos: unknown) => unknown) => fn({ meta, metaOverlays })) as Transact;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("removeMetaEvent", () => {
  it("deletes the event and rejects every mirrored row it was built from", async () => {
    meta.sourcesForEvent.mockResolvedValue([
      { provider: "uvsgames", externalId: "857112" },
      { provider: "playriftbound", externalId: "117451802123511056" },
      { provider: null, externalId: null },
    ]);
    meta.deleteEvent.mockResolvedValue(true);

    expect(await removeMetaEvent(transact, "live-1")).toBe(true);
    expect(meta.deleteEvent).toHaveBeenCalledWith("live-1");
    expect(metaOverlays.ignoreEvent.mock.calls).toEqual([
      ["uvsgames", "857112"],
      ["playriftbound", "117451802123511056"],
    ]);
  });

  it("rejects nothing when the event is already gone", async () => {
    meta.sourcesForEvent.mockResolvedValue([{ provider: "uvsgames", externalId: "1" }]);
    meta.deleteEvent.mockResolvedValue(false);

    expect(await removeMetaEvent(transact, "gone")).toBe(false);
    expect(metaOverlays.ignoreEvent).not.toHaveBeenCalled();
  });
});

describe("unpublishMetaEvent", () => {
  it("deletes an event with no standings without rejecting its rows", async () => {
    meta.eventById.mockResolvedValue({ id: "live-1", playerRowCount: 0 });

    expect(await unpublishMetaEvent(transact, "live-1")).toBe("unpublished");
    expect(meta.deleteEvent).toHaveBeenCalledWith("live-1");
    expect(metaOverlays.ignoreEvent).not.toHaveBeenCalled();
  });

  it("keeps an event that already has standings", async () => {
    meta.eventById.mockResolvedValue({ id: "live-1", playerRowCount: 4 });

    expect(await unpublishMetaEvent(transact, "live-1")).toBe("kept");
    expect(meta.deleteEvent).not.toHaveBeenCalled();
  });

  it("reports a missing event", async () => {
    meta.eventById.mockResolvedValue(undefined);

    expect(await unpublishMetaEvent(transact, "gone")).toBe("missing");
  });
});
