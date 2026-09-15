import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { restartInFlightCopiesRefetch } from "./copies-in-flight-refetch";

const queryKey = ["copies", "user-1", "store"];

describe("restartInFlightCopiesRefetch", () => {
  it("replaces an in-flight copies fetch so its stale result never lands", async () => {
    const client = new QueryClient();
    client.setQueryData(queryKey, "seeded");
    let release = () => {};
    // oxlint-disable-next-line promise/avoid-new -- gate resolved from outside the fetch
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const observer = new QueryObserver(client, {
      queryKey,
      queryFn: async () => {
        calls++;
        if (calls === 1) {
          await gate;
          return "stale";
        }
        return "fresh";
      },
    });
    const unsubscribe = observer.subscribe(() => {});
    expect(client.isFetching({ queryKey })).toBe(1);

    restartInFlightCopiesRefetch(client, "user-1");
    await vi.waitFor(() => expect(client.getQueryData(queryKey)).toBe("fresh"));
    release();
    // oxlint-disable-next-line promise/avoid-new -- let the cancelled fetch settle
    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });

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
