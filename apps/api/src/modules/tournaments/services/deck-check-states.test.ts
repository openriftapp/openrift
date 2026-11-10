import { describe, expect, it, vi } from "vitest";

import type { Repos } from "../../../deps.js";
import { settleExpiredEditableEntries } from "./deck-check-states.js";

const TOURNAMENT_ID = "b0000000-0001-4000-a000-000000000001";
const PAST = new Date("2020-06-01T12:00:00Z");
const FUTURE = new Date("2999-01-01T00:00:00Z");
const EDITED = new Date("2020-05-30T09:00:00Z");

function makeRepos(baselines: unknown[], cards = new Map<string, unknown[]>()) {
  const deckCheck = {
    listEditableBaselines: vi.fn((_id: string) => Promise.resolve(baselines)),
    listCardsForEntries: vi.fn((_ids: string[]) => Promise.resolve(cards)),
    settleEditableEntries: vi.fn((_id: string, rows: { id: string }[]) =>
      Promise.resolve(rows.map((row) => row.id)),
    ),
    updateEntry: vi.fn(),
  };
  return { repos: { deckCheck } as unknown as Repos, deckCheck };
}

describe("settleExpiredEditableEntries", () => {
  it("does nothing while the submission window is open", async () => {
    const { repos, deckCheck } = makeRepos([{ id: "a", preEditLines: null, updatedAt: EDITED }]);

    const settled = await settleExpiredEditableEntries(repos, {
      id: TOURNAMENT_ID,
      status: "active",
      submissionsCloseAt: FUTURE,
    });

    expect(settled).toEqual([]);
    expect(deckCheck.listEditableBaselines).not.toHaveBeenCalled();
    expect(deckCheck.settleEditableEntries).not.toHaveBeenCalled();
  });

  it("submits every expired editable entry in one update, with each entry's change summary", async () => {
    const baseline = [{ name: "Jinx, Loose Cannon", zone: "main", quantity: 3 }];
    const { repos, deckCheck } = makeRepos(
      [
        { id: "a", preEditLines: null, updatedAt: EDITED },
        { id: "b", preEditLines: baseline, updatedAt: EDITED },
        { id: "c", preEditLines: baseline, updatedAt: EDITED },
      ],
      new Map([
        ["b", [{ rawName: "Jinx, Loose Cannon", zone: "main", quantity: 3 }]],
        ["c", [{ rawName: "Vi, Piltover Enforcer", zone: "main", quantity: 1 }]],
      ]),
    );

    const settled = await settleExpiredEditableEntries(repos, {
      id: TOURNAMENT_ID,
      status: "active",
      submissionsCloseAt: PAST,
    });

    expect(settled).toEqual(["a", "b", "c"]);
    expect(deckCheck.listCardsForEntries).toHaveBeenCalledTimes(1);
    expect(deckCheck.listCardsForEntries).toHaveBeenCalledWith(["b", "c"]);
    expect(deckCheck.settleEditableEntries).toHaveBeenCalledTimes(1);
    expect(deckCheck.settleEditableEntries).toHaveBeenCalledWith(TOURNAMENT_ID, [
      { id: "a", submittedAt: PAST, changeSummary: null },
      { id: "b", submittedAt: PAST, changeSummary: null },
      {
        id: "c",
        submittedAt: PAST,
        changeSummary: {
          added: [{ name: "Vi, Piltover Enforcer", zone: "main", quantity: 1 }],
          removed: [{ name: "Jinx, Loose Cannon", zone: "main", quantity: 3 }],
          changed: [],
        },
      },
    ]);
    expect(deckCheck.updateEntry).not.toHaveBeenCalled();
  });

  it("dates an entry by its last change when the event ended without a close time", async () => {
    const { repos, deckCheck } = makeRepos([{ id: "a", preEditLines: null, updatedAt: EDITED }]);

    await settleExpiredEditableEntries(repos, {
      id: TOURNAMENT_ID,
      status: "archived",
      submissionsCloseAt: null,
    });

    expect(deckCheck.settleEditableEntries).toHaveBeenCalledWith(TOURNAMENT_ID, [
      { id: "a", submittedAt: EDITED, changeSummary: null },
    ]);
  });

  it("skips the update when no entry is left editable", async () => {
    const { repos, deckCheck } = makeRepos([]);

    await settleExpiredEditableEntries(repos, {
      id: TOURNAMENT_ID,
      status: "archived",
      submissionsCloseAt: null,
    });

    expect(deckCheck.settleEditableEntries).not.toHaveBeenCalled();
  });
});
