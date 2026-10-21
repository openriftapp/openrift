import { describe, expect, it, vi } from "vitest";

import type { Repos, Transact } from "../../../deps.js";
import type { AdminAccess } from "../../../middleware/require-admin.js";
import type { WorkspaceCardDifferenceRow } from "../repositories/workspace-queue.js";
import {
  discardSameDifference,
  findSameDifference,
  matchSameDifference,
} from "./workspace-same-difference.js";

const LIVE = {
  name: "Jinx, Loose Cannon",
  types: ["unit"],
  superTypes: ["champion"],
  domains: ["chaos"],
  might: 3,
  energy: 4,
  power: 1,
  mightBonus: null,
  tags: ["Jinx"],
};

const ADMIN: AdminAccess = { isAdmin: true, sections: [] };
const HELPER: AdminAccess = { isAdmin: false, sections: ["card-review"] };

function row(
  id: string,
  candidate: Partial<typeof LIVE>,
  over: Partial<WorkspaceCardDifferenceRow> = {},
): WorkspaceCardDifferenceRow {
  return {
    id,
    provider: "gallery",
    createdAt: new Date("2026-10-18T09:00:00.000Z"),
    cardSlug: `card-${id}`,
    cardName: `Card ${id}`,
    candidate: { ...LIVE, ...candidate },
    live: LIVE,
    ...over,
  };
}

const ROWS = [
  row("b", { might: 4 }),
  row("a", { might: 4, energy: 5 }),
  row("c", { might: 5 }),
  row("d", { might: 4 }, { provider: "other" }),
  row("e", {}),
  row("f", { might: 4 }, { live: { ...LIVE, might: 4 } }),
  row("g", { might: 4 }, { live: { ...LIVE, might: 2 } }),
];

function makeRepos(rows = ROWS) {
  return {
    workspaceQueue: { uncheckedCardDifferences: vi.fn().mockResolvedValue(rows) },
    providerSettings: {
      helperReviewableProviders: vi.fn().mockResolvedValue(new Set(["gallery"])),
    },
    candidateCards: { checkCandidateCardsByIds: vi.fn().mockResolvedValue(3) },
    adminEvents: { insert: vi.fn().mockResolvedValue(undefined) },
  };
}

function asRepos(repos: ReturnType<typeof makeRepos>): Repos {
  return repos as unknown as Repos;
}

describe("matchSameDifference", () => {
  it("matches the provider's rows proposing the same differing value, sorted by slug", () => {
    const ids = matchSameDifference(ROWS, { provider: "gallery", field: "might", value: "4" }).map(
      (match) => match.id,
    );
    expect(ids).toEqual(["a", "b", "g"]);
  });

  it("skips a row whose value already equals the live card", () => {
    const ids = matchSameDifference(ROWS, { provider: "gallery", field: "might", value: "4" }).map(
      (match) => match.id,
    );
    expect(ids).not.toContain("f");
  });

  it("narrows to rows replacing the given current value", () => {
    const ids = matchSameDifference(ROWS, {
      provider: "gallery",
      field: "might",
      value: "4",
      currentValue: "3",
    }).map((match) => match.id);
    expect(ids).toEqual(["a", "b"]);
  });

  it("compares list fields in order", () => {
    const rows = [
      row("x", { tags: ["Jinx", "Zaun"] }),
      row("y", { tags: ["Zaun", "Jinx"] }),
      row("z", { tags: ["Zaun"] }),
    ];
    const ids = matchSameDifference(rows, {
      provider: "gallery",
      field: "tags",
      value: JSON.stringify(["Jinx", "Zaun"]),
    }).map((match) => match.id);
    expect(ids).toEqual(["x"]);
  });

  it("never matches an empty proposal", () => {
    const rows = [row("x", { tags: [] })];
    expect(matchSameDifference(rows, { provider: "gallery", field: "tags", value: "[]" })).toEqual(
      [],
    );
  });

  it("rejects a value that is not JSON", () => {
    expect(() =>
      matchSameDifference(ROWS, { provider: "gallery", field: "might", value: "{oops" }),
    ).toThrow("Invalid value");
  });
});

describe("findSameDifference", () => {
  it("returns the count, every id and at most 20 cards", async () => {
    const rows = Array.from({ length: 25 }, (_, index) =>
      row(String(index).padStart(2, "0"), { might: 4 }),
    );
    const repos = makeRepos(rows);
    const result = await findSameDifference(asRepos(repos), {
      access: ADMIN,
      input: { provider: "gallery", field: "might", value: "4" },
    });
    expect(result.count).toBe(25);
    expect(result.candidateCardIds).toHaveLength(25);
    expect(result.cards).toHaveLength(20);
    expect(result.cards[0]).toEqual({ slug: "card-00", name: "Card 00" });
    expect(repos.providerSettings.helperReviewableProviders).not.toHaveBeenCalled();
  });

  it("lets a card-review holder read a reviewable provider", async () => {
    const result = await findSameDifference(asRepos(makeRepos()), {
      access: HELPER,
      input: { provider: "gallery", field: "might", value: "4" },
    });
    expect(result.count).toBe(3);
  });

  it("refuses a card-review holder a provider outside the allowlist", async () => {
    await expect(
      findSameDifference(asRepos(makeRepos()), {
        access: HELPER,
        input: { provider: "other", field: "might", value: "4" },
      }),
    ).rejects.toThrow("Forbidden");
  });
});

describe("discardSameDifference", () => {
  it("checks the matching rows and writes one event per card inside the transaction", async () => {
    const outer = makeRepos([]);
    const inner = makeRepos();
    const transact = vi.fn((fn: (trx: Repos) => Promise<unknown>) =>
      fn(asRepos(inner)),
    ) as unknown as Transact;
    const now = new Date("2026-10-21T15:30:00.000Z");

    const result = await discardSameDifference(transact, asRepos(outer), {
      access: ADMIN,
      userId: "admin-1",
      input: { provider: "gallery", field: "might", value: "4" },
      now,
    });

    expect(result).toEqual({ checked: 3, candidateCardIds: ["a", "b", "g"] });
    expect(outer.workspaceQueue.uncheckedCardDifferences).not.toHaveBeenCalled();
    expect(inner.candidateCards.checkCandidateCardsByIds).toHaveBeenCalledWith(
      ["a", "b", "g"],
      now,
    );
    expect(inner.adminEvents.insert).toHaveBeenCalledTimes(3);
    expect(inner.adminEvents.insert).toHaveBeenCalledWith({
      actorUserId: "admin-1",
      action: "candidate-card.discard-same-difference",
      entityType: "candidate-card",
      entityId: "a",
      entityLabel: "Card a",
      cardSlug: "card-a",
      newValues: { provider: "gallery", field: "might", value: "4" },
    });
  });

  it("refuses an out-of-scope provider before opening a transaction", async () => {
    const transact = vi.fn() as unknown as Transact;
    await expect(
      discardSameDifference(transact, asRepos(makeRepos()), {
        access: HELPER,
        userId: "helper-1",
        input: { provider: "other", field: "might", value: "4" },
        now: new Date(),
      }),
    ).rejects.toThrow("Forbidden");
    expect(transact).not.toHaveBeenCalled();
  });
});
