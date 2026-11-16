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
      queryFn: () => new Promise<string>(() => {}),
    });
    const unsubscribe = observer.subscribe(() => {});
    const refetchSpy = vi.spyOn(client, "refetchQueries").mockResolvedValue();

    settle();

    expect(refetchSpy).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("refetches when a fetch already running as the write began lands during it", async () => {
    const client = new QueryClient();
    let finish = (_value: string) => {};
    const running = client.query({
      queryKey,
      queryFn: () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    });
    const settle = watchForRefetchRace(client, queryKey);
    finish("fetched before the write");
    await running;
    const refetchSpy = vi.spyOn(client, "refetchQueries").mockResolvedValue();

    settle();

    expect(refetchSpy).toHaveBeenCalledOnce();
  });

  it("refetches once when the write itself asks for a reread", () => {
    const client = new QueryClient();
    client.setQueryData(queryKey, "before");
    const refetchSpy = vi.spyOn(client, "refetchQueries").mockResolvedValue();
    const settle = watchForRefetchRace(client, queryKey);

    settle({ reread: true });

    expect(refetchSpy).toHaveBeenCalledExactlyOnceWith(
      { queryKey, exact: true },
      { cancelRefetch: true },
    );
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
