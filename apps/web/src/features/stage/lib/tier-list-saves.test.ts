import { onlineManager, QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";

import {
  TIER_LIST_SAVE_MUTATION_KEY,
  tierListEntryStaleTime,
  tierListSavesSettled,
} from "./tier-list-saves";

describe("tierListEntryStaleTime", () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it("reads fresh online and takes the cache offline", () => {
    expect(tierListEntryStaleTime()).toBe(0);
    onlineManager.setOnline(false);
    expect(tierListEntryStaleTime()).toBe("static");
  });
});

function startSave(queryClient: QueryClient, id: string, mutationKey: readonly unknown[]) {
  let finish: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const mutation = queryClient.getMutationCache().build(queryClient, {
    mutationKey: [...mutationKey],
    mutationFn: () => done,
  });
  const settled = mutation.execute({ id });
  return {
    finish: async () => {
      finish();
      await settled;
    },
  };
}

async function isSettled(promise: Promise<void>): Promise<boolean> {
  let settled = false;
  void promise.then(() => {
    settled = true;
    return settled;
  });
  await Promise.resolve();
  await Promise.resolve();
  return settled;
}

describe("tierListSavesSettled", () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it("resolves straight away with no save in flight", async () => {
    await expect(isSettled(tierListSavesSettled(new QueryClient(), "list-1"))).resolves.toBe(true);
  });

  it("waits for a save of the same list to finish", async () => {
    const queryClient = new QueryClient();
    const save = startSave(queryClient, "list-1", TIER_LIST_SAVE_MUTATION_KEY);

    const waiting = tierListSavesSettled(queryClient, "list-1");
    expect(await isSettled(waiting)).toBe(false);

    await save.finish();
    await expect(waiting).resolves.toBeUndefined();
  });

  it("does not wait for a save of another list or another mutation", async () => {
    const queryClient = new QueryClient();
    startSave(queryClient, "list-2", TIER_LIST_SAVE_MUTATION_KEY);
    startSave(queryClient, "list-1", ["decks", "save"]);

    expect(await isSettled(tierListSavesSettled(queryClient, "list-1"))).toBe(true);
  });

  it("does not wait for a save paused offline", async () => {
    onlineManager.setOnline(false);
    const queryClient = new QueryClient();
    startSave(queryClient, "list-1", TIER_LIST_SAVE_MUTATION_KEY);

    expect(await isSettled(tierListSavesSettled(queryClient, "list-1"))).toBe(true);
  });

  it("stops waiting when a running save pauses for the network", async () => {
    const queryClient = new QueryClient();
    let fail: (error: Error) => void = () => {};
    const attempt = new Promise<void>((_resolve, reject) => {
      fail = reject;
    });
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationKey: [...TIER_LIST_SAVE_MUTATION_KEY],
      mutationFn: () => attempt,
      retry: 1,
      retryDelay: 0,
    });
    void mutation.execute({ id: "list-1" }).catch(() => {});
    const waiting = tierListSavesSettled(queryClient, "list-1");
    expect(await isSettled(waiting)).toBe(false);

    onlineManager.setOnline(false);
    fail(new Error("network down"));

    await expect(waiting).resolves.toBeUndefined();
    expect(mutation.state.isPaused).toBe(true);
  });
});
