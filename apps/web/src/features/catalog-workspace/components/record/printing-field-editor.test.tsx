import type { DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetWorkspaceWriteQueue } from "@/features/catalog-workspace/lib/workspace-write-queue";
import { createQueryClient } from "@/lib/query-client";
import { loadSonner } from "@/lib/toast";

const state = vi.hoisted(() => ({
  update: vi.fn(async (_input: unknown): Promise<void> => {}),
  meta: [] as unknown[],
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/report-error", () => ({ captureHandledError: vi.fn() }));
vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({ orders: { cardSizes: [] }, labels: { cardSizes: {} } }),
}));
vi.mock("@/features/admin/hooks/use-printing-desk", async () => {
  const { useMutation } = await import("@tanstack/react-query");
  return {
    useUpdateDeskPrinting: (meta?: unknown) => {
      state.meta.push(meta);
      return useMutation({
        meta: meta as { inlineError?: boolean } | undefined,
        mutationFn: (input: unknown) => state.update(input),
      });
    },
  };
});

const { PrintingFieldEditor } = await import("./printing-field-editor");

const printing = {
  printingId: "p-1",
  distributionChannelSlugs: [],
  size: "standard",
  announcedAt: null,
  releasedAt: null,
  releasePrecision: null,
  comment: null,
} as unknown as DeskPrintingRow;

function renderEditor(onDone = vi.fn()) {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <PrintingFieldEditor printing={printing} field="comment" onDone={onDone} />
    </QueryClientProvider>,
  );
  return onDone;
}

beforeEach(async () => {
  await loadSonner();
  vi.mocked(toast.error).mockClear();
  state.update.mockReset();
  state.meta = [];
});

afterEach(() => {
  resetWorkspaceWriteQueue();
});

describe("PrintingFieldEditor", () => {
  it("shows a failed save inline and raises no toast", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.update.mockRejectedValue(new Error("Network down"));
    const onDone = renderEditor();

    fireEvent.change(screen.getByLabelText("Comment"), { target: { value: "Prize pool" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Network down")).toBeVisible();
    expect(state.meta.every((meta) => (meta as { inlineError?: boolean }).inlineError)).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("closes once the save lands", async () => {
    const onDone = renderEditor();

    fireEvent.change(screen.getByLabelText("Comment"), { target: { value: "Prize pool" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(state.update).toHaveBeenCalledWith({ printingId: "p-1", comment: "Prize pool" });
  });
});
