import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetWorkspaceWriteQueue } from "@/features/catalog-workspace/lib/workspace-write-queue";
import { useWorkspaceUndoStore } from "@/features/catalog-workspace/stores/workspace-undo-store";
import { createStoreResetter } from "@/test/store-helpers";

const mocks = vi.hoisted(() => ({
  dismiss: vi.fn((_input: unknown, _options?: unknown) => Promise.resolve()),
  restore: vi.fn((_input: unknown) => Promise.resolve()),
}));

vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  restoreCandidateValueFn: mocks.restore,
  useDismissCandidateValue: () => ({ mutateAsync: mocks.dismiss, isPending: false }),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn() }) }));

const { useDismissSuggestion } = await import("./use-dismiss-suggestion");

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

const part = (candidateId: string, source: string) => ({
  kind: "printing" as const,
  candidateId,
  field: "artist",
  value: "Kudos Productions",
  label: "Artist",
  source,
});

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(useWorkspaceUndoStore);
  mocks.dismiss.mockClear();
  mocks.restore.mockClear();
  vi.mocked(toast.success).mockClear();
});

afterEach(() => {
  resetWorkspaceWriteQueue();
  resetStore();
});

describe("useDismissSuggestion", () => {
  it("hides a value two sources report as one undo step with one toast", async () => {
    const { result } = renderHook(() => useDismissSuggestion([], "Teemo, Scout"), { wrapper });

    await act(() => result.current.run([part("cp-1", "gallery"), part("cp-2", "scans")]));

    expect(mocks.dismiss).toHaveBeenCalledTimes(2);
    const { undoStack } = useWorkspaceUndoStore.getState();
    expect(undoStack).toHaveLength(1);
    expect(undoStack[0]?.label).toBe("Hid Artist from gallery, scans on Teemo, Scout");
    expect(toast.success).toHaveBeenCalledOnce();

    const { signal } = new AbortController();
    await undoStack[0]?.undo(signal);
    expect(mocks.restore).toHaveBeenCalledTimes(2);
  });
});
