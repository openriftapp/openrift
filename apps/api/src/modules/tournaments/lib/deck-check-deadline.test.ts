import { describe, expect, it, vi } from "vitest";

import type { Repos } from "../../../deps.js";
import type { DeckCheckEntry } from "../repositories/deck-check-entries.js";
import {
  changeSummaryFor,
  presentDeadlineSettled,
  presentedEntryState,
} from "./deck-check-deadline.js";

const PAST = new Date("2020-06-01T12:00:00Z");
const FUTURE = new Date("2999-01-01T00:00:00Z");
const EDITED = new Date("2020-05-30T09:00:00Z");

function entry(id: string, overrides: Partial<DeckCheckEntry> = {}): DeckCheckEntry {
  return {
    id,
    state: "editable",
    submittedAt: null,
    preEditLines: null,
    changeSummary: null,
    updatedAt: EDITED,
    ...overrides,
  } as DeckCheckEntry;
}

function card(entryId: string, rawName: string, quantity: number) {
  return { entryId, rawName, zone: "main", quantity };
}

function makeRepos(cards = new Map<string, unknown[]>()) {
  const listCardsForEntries = vi.fn((_ids: string[]) => Promise.resolve(cards));
  return { repos: { deckCheck: { listCardsForEntries } } as unknown as Repos, listCardsForEntries };
}

describe("presentDeadlineSettled", () => {
  it("returns entries untouched and reads nothing while the window is open", async () => {
    const { repos, listCardsForEntries } = makeRepos();
    const entries = [entry("a")];

    const presented = await presentDeadlineSettled(
      repos,
      { status: "active", submissionsCloseAt: FUTURE },
      entries,
    );

    expect(presented).toBe(entries);
    expect(listCardsForEntries).not.toHaveBeenCalled();
  });

  it("presents expired editable entries as submitted at the close time, with one card read for the baselines", async () => {
    const baseline = [{ name: "Jinx, Loose Cannon", zone: "main" as const, quantity: 3 }];
    const { repos, listCardsForEntries } = makeRepos(
      new Map([["b", [card("b", "Jinx, Loose Cannon", 2)]]]),
    );

    const presented = await presentDeadlineSettled(
      repos,
      { status: "active", submissionsCloseAt: PAST },
      [entry("a"), entry("b", { preEditLines: baseline }), entry("c", { state: "approved" })],
    );

    expect(listCardsForEntries).toHaveBeenCalledTimes(1);
    expect(listCardsForEntries).toHaveBeenCalledWith(["b"]);
    expect(presented.map((row) => [row.id, row.state, row.submittedAt])).toEqual([
      ["a", "submitted", PAST],
      ["b", "submitted", PAST],
      ["c", "approved", null],
    ]);
    expect(presented[0]?.changeSummary).toBeNull();
    expect(presented[1]?.changeSummary).toEqual({
      added: [],
      removed: [],
      changed: [{ name: "Jinx, Loose Cannon", zone: "main", oldQuantity: 3, newQuantity: 2 }],
    });
  });
});

describe("presentDeadlineSettled without a close time", () => {
  it("dates the submit by the entry's last change, the same on every read", async () => {
    const { repos } = makeRepos();
    const window = { status: "archived", submissionsCloseAt: null };

    const first = await presentDeadlineSettled(repos, window, [entry("a")]);
    const second = await presentDeadlineSettled(repos, window, [entry("a")]);

    expect(first[0]?.state).toBe("submitted");
    expect(first[0]?.submittedAt).toEqual(EDITED);
    expect(second[0]?.submittedAt).toEqual(EDITED);
  });
});

describe("presentedEntryState", () => {
  it("reads an editable entry as submitted once the event is no longer active", () => {
    expect(presentedEntryState({ status: "archived", submissionsCloseAt: null }, entry("a"))).toBe(
      "submitted",
    );
    expect(presentedEntryState({ status: "active", submissionsCloseAt: null }, entry("a"))).toBe(
      "editable",
    );
  });
});

describe("changeSummaryFor", () => {
  it("is null without a baseline or when the list matches it", () => {
    const lines = [{ name: "Jinx, Loose Cannon", zone: "main" as const, quantity: 3 }];
    const cards = [card("a", "Jinx, Loose Cannon", 3)] as never;

    expect(changeSummaryFor(null, cards)).toBeNull();
    expect(changeSummaryFor(lines, cards)).toBeNull();
  });
});
