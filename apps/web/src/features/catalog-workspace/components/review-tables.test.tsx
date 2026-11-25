import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const runs = vi.hoisted(() => ({
  "trusted-cards": {
    mutateAsync: vi.fn(async () => ({ done: 2, skipped: [] })),
    isPending: false,
  },
  "trusted-printings": {
    mutateAsync: vi.fn(async () => {
      throw new Error("Server error");
    }),
    isPending: false,
  },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  Link: ({ children }: { children: ReactNode }) => <a href="/card">{children}</a>,
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock("@/features/catalog-workspace/hooks/use-workspace-batch", () => ({
  readyPreviewQueryOptions: () => ({
    queryKey: ["ready-preview"],
    queryFn: () => ({ cards: {}, printings: {} }),
  }),
  useBatchRun: (kind: keyof typeof runs) => runs[kind],
}));
vi.mock("@/features/catalog-workspace/hooks/workspace-writes", () => ({
  useQueueWorkspaceWrite: () => (task: (signal: AbortSignal) => Promise<void>) =>
    task(new AbortController().signal),
}));
vi.mock("@/features/catalog-workspace/lib/ready-rows", () => ({
  buildReadyRows: () => [],
  selectReadyRows: () => [],
  readyBatchKeys: () => ({ cards: ["Poro Herder"], printings: ["cp-1"] }),
}));

const { ReadyTable } = await import("./review-tables");

describe("ReadyTable", () => {
  it("keeps what the cards batch created when the printings batch fails", async () => {
    const client = new QueryClient();
    client.setQueryData(["ready-preview"], { cards: {}, printings: {} });
    render(
      <QueryClientProvider client={client}>
        <ReadyTable reviewCards={[]} query="" toolbarStart={null} />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Create these 2" }));

    expect(await screen.findByText("Created 2.")).toBeVisible();
  });
});
