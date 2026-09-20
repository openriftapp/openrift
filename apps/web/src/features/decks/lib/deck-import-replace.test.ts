import { describe, expect, it } from "vitest";

import { resolveReplaceTarget } from "./deck-import-replace";

const DECK_ID = "123e4567-e89b-42d3-a456-426614174000";
const inLocalStore = () => true;
const notInLocalStore = () => false;

describe("resolveReplaceTarget", () => {
  it("returns none without a replace id", () => {
    expect(resolveReplaceTarget(undefined, true, inLocalStore)).toEqual({ mode: "none" });
  });

  it("targets a local deck even with a session (regression: went to the server and 404ed)", () => {
    expect(resolveReplaceTarget(DECK_ID, true, inLocalStore)).toEqual({
      mode: "local",
      deckId: DECK_ID,
    });
  });

  it("targets a local deck without a session (regression: silently created a new deck)", () => {
    expect(resolveReplaceTarget(DECK_ID, false, inLocalStore)).toEqual({
      mode: "local",
      deckId: DECK_ID,
    });
  });

  it("targets the server for an id the local store doesn't hold", () => {
    expect(resolveReplaceTarget(DECK_ID, true, notInLocalStore)).toEqual({
      mode: "server",
      deckId: DECK_ID,
    });
  });

  it("degrades to plain import when the id is in neither place", () => {
    expect(resolveReplaceTarget(DECK_ID, false, notInLocalStore)).toEqual({ mode: "none" });
  });
});
