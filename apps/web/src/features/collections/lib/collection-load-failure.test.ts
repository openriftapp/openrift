// @vitest-environment jsdom

import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { createCollection } from "@tanstack/react-db";
import { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { STORE_LOAD_RETRY, watchFailedLoad } from "./collection-load-failure";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), dismiss: vi.fn() } }));

interface Row {
  id: string;
}

interface ToastAction {
  label: string;
  onClick: () => void;
}

let queryClient: QueryClient | undefined;

afterEach(() => {
  queryClient?.clear();
  queryClient = undefined;
  vi.clearAllMocks();
});

function storeFailingFirst(failures = 1) {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let calls = 0;
  return createCollection(
    queryCollectionOptions<Row>({
      id: `load-failure-test-${crypto.randomUUID()}`,
      queryClient,
      queryKey: ["load-failure-test", crypto.randomUUID()],
      queryFn: () => {
        calls++;
        if (calls <= failures) {
          return Promise.reject(new Error("server down"));
        }
        return Promise.resolve([{ id: "a" }]);
      },
      getKey: (row) => row.id,
    }),
  );
}

async function failedStore(failures = 1) {
  const store = storeFailingFirst(failures);
  watchFailedLoad(store, () => "Couldn't load your decks.");
  await expect(store.preload()).rejects.toThrow();
  return store;
}

function lastToastAction(): ToastAction {
  const options = vi.mocked(toast.error).mock.lastCall?.[1] as { action: ToastAction };
  return options.action;
}

describe("watchFailedLoad", () => {
  it("shows a lasting error toast with a retry action when the first load fails", async () => {
    const store = await failedStore();

    expect(toast.error).toHaveBeenCalledWith(
      "Couldn't load your decks.",
      expect.objectContaining({
        id: `load-failed:${store.id}`,
        duration: Number.POSITIVE_INFINITY,
        action: expect.objectContaining({ label: "Retry" }),
      }),
    );
  });

  it("reloads the store from the toast's retry action and dismisses the toast", async () => {
    const store = await failedStore();

    lastToastAction().onClick();

    await expect.poll(() => store.status).toBe("ready");
    expect(store.has("a")).toBe(true);
    expect(toast.dismiss).toHaveBeenCalledWith(`load-failed:${store.id}`);
  });

  it("reloads the store when the window regains focus", async () => {
    const store = await failedStore();

    globalThis.dispatchEvent(new Event("focus"));

    await expect.poll(() => store.status).toBe("ready");
  });

  it("reloads the store when the network returns", async () => {
    const store = await failedStore();

    globalThis.dispatchEvent(new Event("online"));

    await expect.poll(() => store.status).toBe("ready");
  });

  it("shows the toast again and keeps retrying after a failed reload", async () => {
    const store = await failedStore(2);

    globalThis.dispatchEvent(new Event("focus"));
    await expect.poll(() => vi.mocked(toast.error).mock.calls.length).toBe(2);
    expect(store.status).toBe("error");

    globalThis.dispatchEvent(new Event("focus"));

    await expect.poll(() => store.status).toBe("ready");
  });

  it("dismisses the toast when another caller reloads the store", async () => {
    const store = await failedStore();

    await store.reload();

    expect(toast.dismiss).toHaveBeenCalledWith(`load-failed:${store.id}`);
  });

  it("stays quiet for a store that loads", async () => {
    const store = storeFailingFirst(0);
    watchFailedLoad(store, () => "Couldn't load your decks.");
    await store.preload();

    globalThis.dispatchEvent(new Event("focus"));

    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.dismiss).not.toHaveBeenCalled();
    expect(store.health.reloading).toBe(false);
  });
});

describe("STORE_LOAD_RETRY", () => {
  const offline = new TypeError("Failed to fetch");

  it("retries three times over about five and a half seconds", () => {
    const delays = [0, 1, 2].map((attempt) => STORE_LOAD_RETRY.retryDelay(attempt));
    expect(delays).toEqual([1000, 2000, 2500]);
    expect([0, 1, 2, 3].map((count) => STORE_LOAD_RETRY.retry(count, offline))).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it("does not retry a refusal the server means", () => {
    expect(STORE_LOAD_RETRY.retry(0, { name: "ApiError", message: "no", status: 404 })).toBe(false);
  });

  it("rides out a restart that clears on the third attempt without a toast", async () => {
    vi.useFakeTimers();
    queryClient = new QueryClient();
    let calls = 0;
    const store = createCollection(
      queryCollectionOptions<Row>({
        id: `restart-test-${crypto.randomUUID()}`,
        queryClient,
        queryKey: ["restart-test", crypto.randomUUID()],
        ...STORE_LOAD_RETRY,
        queryFn: () => {
          calls++;
          return calls < 3 ? Promise.reject(offline) : Promise.resolve([{ id: "a" }]);
        },
        getKey: (row) => row.id,
      }),
    );
    watchFailedLoad(store, () => "Couldn't load your decks.");

    const loaded = store.preload();
    await vi.advanceTimersByTimeAsync(3500);
    await loaded;
    vi.useRealTimers();

    expect(calls).toBe(3);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
