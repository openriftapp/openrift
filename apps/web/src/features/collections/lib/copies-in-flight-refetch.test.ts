import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { restartInFlightCopiesRefetch } from "./copies-in-flight-refetch";

const queryKey = ["copies", "user-1", "store"];

describe("restartInFlightCopiesRefetch", () => {
  it("replaces an in-flight copies fetch so its stale result never lands", async () => {
    const client = new QueryClient();
    client.setQueryData(queryKey, "seeded");
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    let staleFetch: Promise<string> | undefined;
    let staleSignal: AbortSignal | undefined;
    const observer = new QueryObserver(client, {
      queryKey,
      queryFn: ({ signal }) => {
        calls++;
        if (calls === 1) {
          staleSignal = signal;
          staleFetch = gate.then(() => "stale");
          return staleFetch;
        }
        return Promise.resolve("fresh");
      },
    });
    const unsubscribe = observer.subscribe(() => {});
    expect(client.isFetching({ queryKey })).toBe(1);

    restartInFlightCopiesRefetch(client, "user-1");
    await vi.waitFor(() => expect(client.getQueryData(queryKey)).toBe("fresh"));
    // A cancelled fetch's retryer has already rejected, so its late result has nowhere to land.
    expect(staleSignal?.aborted).toBe(true);
    release();
    await staleFetch;

    expect(client.getQueryData(queryKey)).toBe("fresh");
    unsubscribe();
  });

  it("does not refetch when no copies fetch is running", () => {
    const client = new QueryClient();
    client.setQueryData(queryKey, "seeded");
    const refetchSpy = vi.spyOn(client, "refetchQueries");

    restartInFlightCopiesRefetch(client, "user-1");

    expect(refetchSpy).not.toHaveBeenCalled();
  });
});
