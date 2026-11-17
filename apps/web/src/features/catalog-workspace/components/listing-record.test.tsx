import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { workspaceQueueQueryOptions } from "@/features/catalog-workspace/lib/workspace-queries";
import { useWorkspaceActionsStore } from "@/features/catalog-workspace/stores/workspace-actions-store";
import { stubPrinting } from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

const allPrintings = [
  stubPrinting({
    printingId: "p-jinx",
    shortCode: "OGN-030",
    publicCode: "OGN-030",
    finish: "normal",
    language: "EN",
    card: { name: "Jinx, Loose Cannon" },
  }),
  stubPrinting({
    printingId: "p-vi",
    shortCode: "OGN-031",
    publicCode: "OGN-031",
    finish: "foil",
    language: "EN",
    card: { name: "Vi, Piltover Enforcer" },
  }),
];

vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({ allPrintings }),
}));

vi.mock("@/features/admin/hooks/use-admin", () => ({
  useAdminAccess: () => ({ data: { isAdmin: true }, isPending: false }),
}));

const { ListingPrintingCombobox, ListingRecord } = await import("./listing-record");

describe("ListingRecord", () => {
  let reset: () => void;
  beforeEach(() => {
    reset = createStoreResetter(useWorkspaceActionsStore);
  });
  afterEach(() => reset());

  it("registers without actions when the listing left the queue, so Enter moves on", () => {
    const client = new QueryClient();
    client.setQueryData(workspaceQueueQueryOptions().queryKey, { items: [] } as never);
    render(
      <QueryClientProvider client={client}>
        <ListingRecord ownerId="listing:gone" />
      </QueryClientProvider>,
    );

    expect(screen.getByText(/not in the queue any more/u)).toBeInTheDocument();
    const state = useWorkspaceActionsStore.getState();
    expect(state.owner).not.toBeNull();
    expect(state.actions).toEqual({});
  });
});

describe("ListingPrintingCombobox", () => {
  it("asks for three characters before it searches", async () => {
    const user = userEvent.setup();
    render(<ListingPrintingCombobox disabled={false} onPick={vi.fn()} />);

    await user.type(screen.getByRole("combobox", { name: "Printing name or code" }), "ji");

    expect(await screen.findByText("Type 3 characters to search.")).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("matches by card name", async () => {
    const user = userEvent.setup();
    render(<ListingPrintingCombobox disabled={false} onPick={vi.fn()} />);

    await user.type(screen.getByRole("combobox", { name: "Printing name or code" }), "jinx");

    expect(await screen.findByRole("option", { name: /Jinx, Loose Cannon/u })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Vi, Piltover Enforcer/u }),
    ).not.toBeInTheDocument();
  });

  it("picks a match by code with the arrow keys", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<ListingPrintingCombobox disabled={false} onPick={onPick} />);

    await user.type(screen.getByRole("combobox", { name: "Printing name or code" }), "ogn-031");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onPick).toHaveBeenCalledExactlyOnceWith("p-vi");
  });

  it("says so when nothing matches", async () => {
    const user = userEvent.setup();
    render(<ListingPrintingCombobox disabled={false} onPick={vi.fn()} />);

    await user.type(screen.getByRole("combobox", { name: "Printing name or code" }), "zaun");

    expect(await screen.findByText("No printing matches.")).toBeInTheDocument();
  });
});
