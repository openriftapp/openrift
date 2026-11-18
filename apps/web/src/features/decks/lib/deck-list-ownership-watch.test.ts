import type { QueryKey } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { collectionsKeys, copiesKeys } from "@/features/collections/lib/collections-query-keys";
import { decksKeys } from "@/features/decks/lib/decks-query-keys";
import { loansKeys } from "@/features/groups/lib/groups-query-keys";

import { watchOwnershipForDeckList } from "./deck-list-ownership-watch";

const USER = "user-1";

describe("watchOwnershipForDeckList", () => {
  let queryClient: QueryClient;
  let invalidate: ReturnType<typeof vi.spyOn>;
  let stop: () => void;

  /** The path query-db-collection's writeInsert/writeUpsert/writeDelete take. */
  const storeWrite = (queryKey: QueryKey, data: unknown) => {
    queryClient.getQueryCache().find({ queryKey, exact: true })?.setState({ data });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    queryClient = new QueryClient();
    invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
  });

  it("refetches the deck list when a refetch brings new copies", () => {
    queryClient.setQueryData(copiesKeys.syncedStore(USER), [{ id: "a" }]);
    stop = watchOwnershipForDeckList(queryClient, USER);

    queryClient.setQueryData(copiesKeys.syncedStore(USER), [{ id: "a" }, { id: "b" }]);
    vi.runAllTimers();

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: decksKeys.syncedStore(USER),
      exact: true,
    });
  });

  it("refetches the deck list after a direct store write", () => {
    queryClient.setQueryData(copiesKeys.syncedStore(USER), [{ id: "a" }]);
    stop = watchOwnershipForDeckList(queryClient, USER);

    storeWrite(copiesKeys.syncedStore(USER), [{ id: "a" }, { id: "b" }]);
    vi.runAllTimers();

    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("coalesces a burst of changes into one refetch", () => {
    queryClient.setQueryData(collectionsKeys.syncedStore(USER), [{ id: "box", on: true }]);
    queryClient.setQueryData(loansKeys.all(USER), { items: [] });
    queryClient.setQueryData(copiesKeys.syncedStore(USER), [{ id: "a" }]);
    stop = watchOwnershipForDeckList(queryClient, USER);

    queryClient.setQueryData(collectionsKeys.syncedStore(USER), [{ id: "box", on: false }]);
    queryClient.setQueryData(loansKeys.all(USER), { items: [{ id: "loan" }] });
    storeWrite(copiesKeys.syncedStore(USER), [{ id: "a", onLoan: true }]);
    expect(invalidate).not.toHaveBeenCalled();
    vi.runAllTimers();

    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("ignores the first load, which the deck list already reflects", () => {
    stop = watchOwnershipForDeckList(queryClient, USER);

    queryClient.setQueryData(copiesKeys.syncedStore(USER), [{ id: "a" }]);
    vi.runAllTimers();

    expect(invalidate).not.toHaveBeenCalled();
  });

  it("ignores a refetch that returns the same data", () => {
    queryClient.setQueryData(copiesKeys.syncedStore(USER), [{ id: "a" }]);
    stop = watchOwnershipForDeckList(queryClient, USER);

    queryClient.setQueryData(copiesKeys.syncedStore(USER), [{ id: "a" }]);
    vi.runAllTimers();

    expect(invalidate).not.toHaveBeenCalled();
  });

  it("ignores another user's data and drops a pending refetch when stopped", () => {
    queryClient.setQueryData(copiesKeys.syncedStore(USER), [{ id: "a" }]);
    queryClient.setQueryData(copiesKeys.syncedStore("someone-else"), [{ id: "x" }]);
    stop = watchOwnershipForDeckList(queryClient, USER);

    queryClient.setQueryData(copiesKeys.syncedStore("someone-else"), [{ id: "y" }]);
    queryClient.setQueryData(copiesKeys.syncedStore(USER), [{ id: "b" }]);
    stop();
    vi.runAllTimers();

    expect(invalidate).not.toHaveBeenCalled();
  });
});
