// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pricesKeys } from "@/features/cards/lib/cards-query-keys";

import { DeckOwnershipNote } from "./deck-ownership-note";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderNote(failPrices: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (failPrices) {
    await client
      .query({ queryKey: pricesKeys.all, queryFn: () => Promise.reject(new Error("down")) })
      .catch(() => {});
  }
  render(
    <QueryClientProvider client={client}>
      <DeckOwnershipNote enabled />
    </QueryClientProvider>,
  );
}

describe("DeckOwnershipNote", () => {
  it("offers a retry once the prices failed to load", async () => {
    await renderNote(true);

    expect(screen.getByRole("status")).toHaveTextContent("Prices and ownership couldn't load.");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("renders nothing while nothing failed", async () => {
    await renderNote(false);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
