import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const run = vi.hoisted(() => ({
  mutateAsync: vi.fn(() => Promise.resolve({ done: 2, skipped: [] })),
  reset: vi.fn(),
  isPending: false,
  error: null,
}));

vi.mock("@/features/catalog-workspace/hooks/use-workspace-batch", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useBatchRun: () => run,
  useListingsBatchPreview: () => ({
    count: 2,
    names: ["Gold Token Foil", "Poro Normal"],
    keys: ["l1", "l2"],
    ineligible: [],
  }),
}));

const { AssignSuggestedListingsButton } = await import("./batch-dialogs");

const { resetWorkspaceWriteQueue } =
  await import("@/features/catalog-workspace/lib/workspace-write-queue");

describe("AssignSuggestedListingsButton", () => {
  beforeEach(() => {
    resetWorkspaceWriteQueue();
    run.mutateAsync.mockImplementation(() => Promise.resolve({ done: 2, skipped: [] }));
  });

  it("stays open while its run is in flight", async () => {
    run.mutateAsync.mockImplementation(() => new Promise(() => {}));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AssignSuggestedListingsButton />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Map 2 listings by suggestion" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Map 2 listings by suggestion" }));
    await waitFor(() => expect(run.mutateAsync).toHaveBeenCalled());
    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(screen.getByRole("dialog")).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("offers the confirm button again after Done closes a finished run", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AssignSuggestedListingsButton />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Map 2 listings by suggestion" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Map 2 listings by suggestion" }));
    fireEvent.click(await screen.findByRole("button", { name: "Done" }));
    expect(run.reset).toHaveBeenCalled();

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Map 2 listings by suggestion" }));
    const reopened = await screen.findByRole("dialog");
    expect(
      within(reopened).getByRole("button", { name: "Map 2 listings by suggestion" }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
  });
});
