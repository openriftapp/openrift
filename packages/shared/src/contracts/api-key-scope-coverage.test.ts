import { describe, expect, it } from "vitest";

import { isApiKeyScope } from "../api-key-scopes.js";
import { collectionEventsContract } from "./collection-events.js";
import { collectionValueHistoryContract } from "./collection-value-history.js";
import { collectionsContract } from "./collections.js";
import { copiesContract } from "./copies.js";
import { deckFoldersContract } from "./deck-folders.js";
import { decksContract } from "./decks.js";
import { listsContract } from "./lists.js";

// Procedures in these contracts that API keys must never reach: sharing,
// trade cancellation, the account-wide reset, and cloning someone else's deck.
const KEY_REFUSED = new Set([
  "collections.resetAll",
  "collections.resetAllTradeCancels",
  "collections.removeTradeCancels",
  "collections.clearTradeCancels",
  "collections.share",
  "collections.shareState",
  "collections.unshare",
  "collections.groupShares",
  "copies.moveTradeCancels",
  "copies.disposeTradeCancels",
  "lists.getShare",
  "lists.share",
  "lists.unshare",
  "lists.groupShares",
  "decks.getShare",
  "decks.share",
  "decks.unshare",
  "decks.cloneShared",
]);

const CONTRACTS = {
  collectionEvents: collectionEventsContract,
  collectionValueHistory: collectionValueHistoryContract,
  collections: collectionsContract,
  copies: copiesContract,
  deckFolders: deckFoldersContract,
  decks: decksContract,
  lists: listsContract,
};

function procedures(): { name: string; scope: unknown }[] {
  return Object.entries(CONTRACTS).flatMap(([contract, procs]) =>
    Object.entries(procs).map(([key, proc]) => ({
      name: `${contract}.${key}`,
      scope: (proc as { "~orpc": { meta: Record<string, unknown> } })["~orpc"].meta.apiKeyScope,
    })),
  );
}

describe("API key scope coverage", () => {
  it("classifies every collection, list and deck procedure", () => {
    const unclassified = procedures()
      .filter(({ name, scope }) => !KEY_REFUSED.has(name) && !isApiKeyScope(scope))
      .map(({ name }) => name);
    expect(unclassified).toEqual([]);
  });

  it("gives refused procedures no scope", () => {
    const scopedButRefused = procedures()
      .filter(({ name, scope }) => KEY_REFUSED.has(name) && scope !== undefined)
      .map(({ name }) => name);
    expect(scopedButRefused).toEqual([]);
  });
});
