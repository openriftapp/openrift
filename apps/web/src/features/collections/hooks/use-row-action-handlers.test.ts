import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SurfaceRowActionsStore } from "@/features/cards/stores/card-row-actions-store";
import { createCardRowActionsStore } from "@/features/cards/stores/card-row-actions-store";
import { useRowActionHandlers } from "@/features/collections/hooks/use-row-action-handlers";

describe("useRowActionHandlers", () => {
  it("registers the surface's handlers on mount", () => {
    const store: SurfaceRowActionsStore<"catalog"> = createCardRowActionsStore();
    const onRowClick = vi.fn();
    renderHook(() => useRowActionHandlers(store, { onRowClick }));

    expect(store.getState().handlers.onRowClick).toBe(onRowClick);
  });

  it("re-registers on every render so cells dispatch the freshest closure", () => {
    const store: SurfaceRowActionsStore<"list"> = createCardRowActionsStore();
    const { rerender } = renderHook(({ handler }) => useRowActionHandlers(store, handler), {
      initialProps: { handler: { onRowClick: vi.fn() } },
    });

    const fresh = vi.fn();
    rerender({ handler: { onRowClick: fresh } });

    expect(store.getState().handlers.onRowClick).toBe(fresh);
  });

  it("leaves another surface's store alone", () => {
    const catalog: SurfaceRowActionsStore<"catalog"> = createCardRowActionsStore();
    const collection: SurfaceRowActionsStore<"collection"> = createCardRowActionsStore();
    const catalogClick = vi.fn();
    const collectionClick = vi.fn();
    renderHook(() => useRowActionHandlers(catalog, { onRowClick: catalogClick }));
    const outgoing = renderHook(() =>
      useRowActionHandlers(collection, { onRowClick: collectionClick }),
    );

    outgoing.unmount();

    expect(catalog.getState().handlers.onRowClick).toBe(catalogClick);
  });

  it("accepts only the handlers of the store's surface", () => {
    const store: SurfaceRowActionsStore<"catalog"> = createCardRowActionsStore();
    // @ts-expect-error onRemoveEntry belongs to the list surface
    renderHook(() => useRowActionHandlers(store, { onRemoveEntry: vi.fn() }));
  });
});
