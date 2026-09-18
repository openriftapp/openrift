import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStoreResetter } from "@/test/store-helpers";

import { useArchiveListsStore } from "./archive-lists-store";

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(useArchiveListsStore);
});

afterEach(() => {
  resetStore();
});

describe("useArchiveListsStore", () => {
  it("records a pick and an override per participant", () => {
    const store = useArchiveListsStore.getState();
    store.open("t1");
    store.pick("p1", "u11");
    store.pick("p2", null);
    store.setForced("p1", true);

    const state = useArchiveListsStore.getState();
    expect(state.picks).toEqual({ p1: "u11", p2: null });
    expect(state.forced).toEqual({ p1: true });
  });

  it("keeps the choices when the same tournament opens again", () => {
    useArchiveListsStore.getState().open("t1");
    useArchiveListsStore.getState().pick("p1", "u11");
    useArchiveListsStore.getState().open("t1");

    expect(useArchiveListsStore.getState().picks).toEqual({ p1: "u11" });
  });

  it("drops the choices when another tournament opens", () => {
    useArchiveListsStore.getState().open("t1");
    useArchiveListsStore.getState().pick("p1", "u11");
    useArchiveListsStore.getState().setForced("p1", true);
    useArchiveListsStore.getState().open("t2");

    const state = useArchiveListsStore.getState();
    expect(state).toMatchObject({ tournamentId: "t2", picks: {}, forced: {} });
  });
});
