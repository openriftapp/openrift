import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const run = vi.hoisted(() => ({
  mutateAsync: vi.fn(() => Promise.resolve({ done: 2, skipped: [] })),
  reset: vi.fn(),
  isPending: false,
  error: null,
}));

vi.mock("@/features/catalog-workspace/hooks/use-workspace-batch", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useWorkspaceBatch: () => ({
    preview: {
      count: 2,
      names: ["Ekko, Recurrent", "Jinx, Demolitionist"],
      keys: ["ekko", "jinx"],
      ineligible: [],
    },
    isPreviewPending: false,
    run,
  }),
}));

const { BatchButton } = await import("./batch-dialogs");

describe("BatchButton", () => {
  it("offers the confirm button again after Done closes a finished run", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BatchButton kind="trusted-cards" />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Accept 2 trusted new cards" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Accept 2 trusted new cards" }));
    fireEvent.click(await screen.findByRole("button", { name: "Done" }));
    expect(run.reset).toHaveBeenCalled();

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Accept 2 trusted new cards" }));
    const reopened = await screen.findByRole("dialog");
    expect(
      within(reopened).getByRole("button", { name: "Accept 2 trusted new cards" }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
  });
});
