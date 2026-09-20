import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { watchForRefetchRace } from "./refetch-race";

const queryKey = ["copies", "user-1", "store"];

describe("watchForRefetchRace", () => {
  it("refetches when a fetch for the key landed while the write persisted", async () => {
    const client = new QueryClient();
    client.setQueryData(queryKey, "before");
    const settle = watchForRefetchRace(client, queryKey);

    await client.query({ queryKey, queryFn: async () => "fetched during the write" });
    const refetchSpy = vi.spyOn(client, "refetchQueries").mockResolvedValue();
    settle();

    expect(refetchSpy).toHaveBeenCalledWith({ queryKey, exact: true }, { cancelRefetch: true });
  });

  it("refetches when a fetch for the key is still running as the write ends", () => {
    const client = new QueryClient();
    client.setQueryData(queryKey, "seeded");
    const settle = watchForRefetchRace(client, queryKey);
    const observer = new QueryObserver(client, {
      queryKey,
      // oxlint-disable-next-line promise/avoid-new -- a fetch that never settles during the test
      queryFn: () => new Promise<string>(() => {}),
    });
    const unsubscribe = observer.subscribe(() => {});
    const refetchSpy = vi.spyOn(client, "refetchQueries").mockResolvedValue();

    settle();

    expect(refetchSpy).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("ignores a collection's own writes to the cached data", () => {
    const client = new QueryClient();
    client.setQueryData(queryKey, "before");
    const refetchSpy = vi.spyOn(client, "refetchQueries");
    const settle = watchForRefetchRace(client, queryKey);

    client.setQueryData(queryKey, "written by the store");
    settle();

    expect(refetchSpy).not.toHaveBeenCalled();
  });

  it("ignores fetches for other keys", async () => {
    const client = new QueryClient();
    const refetchSpy = vi.spyOn(client, "refetchQueries");
    const settle = watchForRefetchRace(client, queryKey);

    await client.query({ queryKey: ["collections", "user-1", "store"], queryFn: async () => [] });
    settle();

    expect(refetchSpy).not.toHaveBeenCalled();
  });
});
