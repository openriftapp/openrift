import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetWorkspaceWriteQueue } from "@/features/catalog-workspace/lib/workspace-write-queue";
import { useWorkspaceUndoStore } from "@/features/catalog-workspace/stores/workspace-undo-store";
import {
  makeAdminCardDetail,
  makeCandidateCard,
  makeCandidatePrinting,
  resetIdCounter,
} from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

const mocks = vi.hoisted(() => ({
  ignore: vi.fn((_input: unknown, _options?: unknown) => Promise.resolve()),
  unignore: vi.fn((_input: unknown) => Promise.resolve()),
}));

vi.mock("@/features/admin/hooks/use-ignored-candidates", () => ({
  unignoreCandidateCardFn: vi.fn(),
  unignoreCandidatePrintingFn: mocks.unignore,
  useIgnoreCandidatePrinting: () => ({ mutateAsync: mocks.ignore, isPending: false }),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const { useIgnorePrintingGroup } = await import("./use-ignore-printing-group");

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

let resetStore: () => void;

beforeEach(() => {
  resetIdCounter();
  resetStore = createStoreResetter(useWorkspaceUndoStore);
  mocks.ignore.mockReset();
  mocks.unignore.mockClear();
});

afterEach(() => {
  resetWorkspaceWriteQueue();
  resetStore();
});

describe("useIgnorePrintingGroup", () => {
  it("keeps an undo for the rows it ignored when a later one fails", async () => {
    const gallery = makeCandidateCard({ provider: "gallery" });
    const scans = makeCandidateCard({ provider: "scans" });
    const first = makeCandidatePrinting({ candidateCardId: gallery.id, externalId: "g-1" });
    const second = makeCandidatePrinting({ candidateCardId: scans.id, externalId: "s-1" });
    const detail = makeAdminCardDetail({
      sources: [gallery, scans],
      candidatePrintings: [first, second],
    });
    mocks.ignore.mockResolvedValueOnce().mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useIgnorePrintingGroup([]), { wrapper });
    const { signal } = new AbortController();

    let complete: boolean | undefined;
    await act(async () => {
      complete = await result.current.run(signal, detail, [first, second]);
    });

    expect(complete).toBe(false);
    const { undoStack } = useWorkspaceUndoStore.getState();
    expect(undoStack).toHaveLength(1);
    await undoStack[0]?.undo(signal);
    expect(mocks.unignore).toHaveBeenCalledExactlyOnceWith({
      data: { provider: "gallery", externalId: "g-1", finish: first.finish },
      signal,
    });
  });
});
