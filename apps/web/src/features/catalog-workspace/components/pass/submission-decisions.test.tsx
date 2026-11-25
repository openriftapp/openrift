import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { makeAdminCardDetail } from "@/test/factories";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(() => new Promise(() => {})),
  queued: [] as ((signal: AbortSignal) => Promise<void>)[],
}));

vi.mock("@/features/admin/hooks/use-catalog-review", () => ({
  useAcceptSubmission: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}));
vi.mock("@/features/catalog-workspace/hooks/workspace-writes", () => ({
  useQueueWorkspaceWrite: () => (task: (signal: AbortSignal) => Promise<void>) => {
    mocks.queued.push(task);
    return Promise.resolve(true);
  },
}));
vi.mock("@/features/admin/components/move-submission-dialog", () => ({
  MoveSubmissionDialog: () => null,
}));
vi.mock("@/features/admin/components/reject-submission-dialog", () => ({
  RejectSubmissionDialog: () => null,
}));

const { useSubmissionDecisions } = await import("./submission-decisions");

describe("useSubmissionDecisions", () => {
  it("queues one mark-applied per contribution until the first one settles", () => {
    const { result } = renderHook(() =>
      useSubmissionDecisions({
        cardSlug: "poro",
        detail: makeAdminCardDetail(),
        submissions: [],
        isAdmin: true,
      }),
    );

    act(() => result.current.onMarkApplied("cc-1"));
    act(() => result.current.onMarkApplied("cc-1"));

    expect(mocks.queued).toHaveLength(1);
    expect(result.current.markingApplied).toBe(true);
  });
});
