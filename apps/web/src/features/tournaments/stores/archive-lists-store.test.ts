import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStoreResetter } from "@/test/store-helpers";

import { archiveForced, archivePicks, useArchiveListsStore } from "./archive-lists-store";

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
    store.pick("t1", "p1", "u11");
    store.pick("t1", "p2", null);
    store.setForced("t1", "p1", true);

    const state = useArchiveListsStore.getState();
    expect(archivePicks(state, "t1")).toEqual({ p1: "u11", p2: null });
    expect(archiveForced(state, "t1")).toEqual({ p1: true });
  });

  it("keeps earlier picks when the same tournament changes an override", () => {
    useArchiveListsStore.getState().pick("t1", "p1", "u11");
    useArchiveListsStore.getState().setForced("t1", "p2", true);

    expect(archivePicks(useArchiveListsStore.getState(), "t1")).toEqual({ p1: "u11" });
  });

  it("reads another tournament's choices as none", () => {
    useArchiveListsStore.getState().pick("t1", "p1", "u11");
    useArchiveListsStore.getState().setForced("t1", "p1", true);

    const state = useArchiveListsStore.getState();
    expect(archivePicks(state, "t2")).toEqual({});
    expect(archiveForced(state, "t2")).toEqual({});
    expect(archivePicks(state, "t2")).toBe(archivePicks(state, "t3"));
  });

  it("drops the choices when another tournament is picked", () => {
    useArchiveListsStore.getState().pick("t1", "p1", "u11");
    useArchiveListsStore.getState().setForced("t1", "p1", true);
    useArchiveListsStore.getState().setForced("t2", "p9", true);

    const state = useArchiveListsStore.getState();
    expect(state).toMatchObject({ tournamentId: "t2", picks: {}, forced: { p9: true } });
    expect(archivePicks(state, "t1")).toEqual({});
  });
});
