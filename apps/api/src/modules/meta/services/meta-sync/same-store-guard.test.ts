import { describe, expect, it } from "vitest";

import { findSameStoreEvent } from "./same-store-guard.js";

const LIVE = [
  { id: "a", name: "Nexus Night", eventDate: "2026-10-17", organizer: "Bandle City Games" },
  { id: "b", name: "Radiance Pre-Rift", eventDate: "2026-10-17", organizer: "Piltover Hobbies" },
];

describe("findSameStoreEvent", () => {
  it("finds the same store's event a day apart under a similar name", () => {
    const twin = findSameStoreEvent(
      { name: "Nexus Night 1v1", eventDate: "2026-10-18", organizer: "Bandle City Games GmbH" },
      LIVE,
    );
    expect(twin?.id).toBe("a");
  });

  it("lets a different event at the same store on the same day pass", () => {
    expect(
      findSameStoreEvent(
        { name: "Radiance Pre-Rift", eventDate: "2026-10-17", organizer: "Bandle City Games" },
        LIVE,
      ),
    ).toBeUndefined();
  });

  it("lets the same name at another store, or two days away, pass", () => {
    expect(
      findSameStoreEvent(
        { name: "Nexus Night", eventDate: "2026-10-17", organizer: "Zaun Card Den" },
        LIVE,
      ),
    ).toBeUndefined();
    expect(
      findSameStoreEvent(
        { name: "Nexus Night", eventDate: "2026-10-19", organizer: "Bandle City Games" },
        LIVE,
      ),
    ).toBeUndefined();
  });

  it("never matches without a store on either side", () => {
    expect(
      findSameStoreEvent({ name: "Nexus Night", eventDate: "2026-10-17", organizer: null }, LIVE),
    ).toBeUndefined();
    expect(
      findSameStoreEvent(
        { name: "Nexus Night", eventDate: "2026-10-17", organizer: "Bandle City Games" },
        [{ id: "a", name: "Nexus Night", eventDate: "2026-10-17", organizer: null }],
      ),
    ).toBeUndefined();
  });
});
