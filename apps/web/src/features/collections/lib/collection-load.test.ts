import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { createCollection } from "@tanstack/react-db";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";

import { loadCollection } from "./collection-load";

interface Row {
  id: string;
}

let queryClient: QueryClient | undefined;

afterEach(() => {
  queryClient?.clear();
  queryClient = undefined;
});

function storeFailingFirst(failures = 1) {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let calls = 0;
  return createCollection(
    queryCollectionOptions<Row>({
      id: `load-test-${crypto.randomUUID()}`,
      queryClient,
      queryKey: ["load-test", crypto.randomUUID()],
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

describe("loadCollection", () => {
  it("loads a fresh store", async () => {
    const store = storeFailingFirst(0);

    await loadCollection(store);

    expect(store.status).toBe("ready");
    expect(store.has("a")).toBe(true);
  });

  it("recovers a store whose first load failed", async () => {
    const store = storeFailingFirst();
    await expect(store.preload()).rejects.toThrow();
    expect(store.status).toBe("error");

    await loadCollection(store);

    expect(store.status).toBe("ready");
    expect(store.has("a")).toBe(true);
  });

  it("rejects while the server keeps failing", async () => {
    const store = storeFailingFirst(2);
    await expect(store.preload()).rejects.toThrow();

    await expect(loadCollection(store)).rejects.toThrow();
    expect(store.status).toBe("error");
  });
});
