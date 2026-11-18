import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { mockGetCopiesCollection } = vi.hoisted(() => ({
  mockGetCopiesCollection: vi.fn(),
}));

vi.mock("@/features/collections/lib/copies-collection", () => ({
  getCopiesCollection: mockGetCopiesCollection,
}));

import { useCopiesCollection } from "./use-copies-collection";

describe("useCopiesCollection during a server render", () => {
  it("returns null for a signed-in viewer without building a collection", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["session"], { user: { id: "user-1" } });
    const seen: unknown[] = [];
    function Probe() {
      seen.push(useCopiesCollection());
      return null;
    }

    renderToString(
      createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)),
    );

    expect(seen).toEqual([null]);
    expect(mockGetCopiesCollection).not.toHaveBeenCalled();
  });
});
