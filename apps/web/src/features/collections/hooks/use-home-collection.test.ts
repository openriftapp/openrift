import type { CollectionResponse } from "@openrift/shared/types/api/collection";
import { createCollection, localOnlyCollectionOptions } from "@tanstack/react-db";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { stubCollection } from "@/test/factories";

const collectionsCollection = createCollection(
  localOnlyCollectionOptions<CollectionResponse>({
    id: "collections:home-collection-test",
    getKey: (row) => row.id,
  }),
);

let signedIn = true;

vi.mock("@/features/collections/hooks/use-collections-collection", () => ({
  useCollectionsCollection: () => (signedIn ? collectionsCollection : null),
}));

const { useHomeCollection } = await import("./use-home-collection");

describe("useHomeCollection", () => {
  beforeEach(() => {
    signedIn = true;
    const existing = collectionsCollection.toArray;
    if (existing.length > 0) {
      collectionsCollection.delete(existing.map((row) => row.id));
    }
    collectionsCollection.insert([
      stubCollection({ id: "col-1", name: "Deck Box" }),
      stubCollection({ id: "col-2", name: "Binder" }),
    ]);
  });

  it("resolves the requested collection and not its neighbours", async () => {
    const { result } = renderHook(() => useHomeCollection("col-1"));

    await waitFor(() => expect(result.current?.name).toBe("Deck Box"));
    expect(result.current?.id).toBe("col-1");
  });

  it("is undefined for an id the viewer has no collection for", async () => {
    const { result } = renderHook(() => useHomeCollection("col-9"));

    await waitFor(() => expect(result.current).toBeUndefined());
  });

  it("is undefined without a collection id", () => {
    const { result } = renderHook(() => useHomeCollection(null));

    expect(result.current).toBeUndefined();
  });

  it("is undefined while nobody is signed in", () => {
    signedIn = false;

    const { result } = renderHook(() => useHomeCollection("col-1"));

    expect(result.current).toBeUndefined();
  });
});
