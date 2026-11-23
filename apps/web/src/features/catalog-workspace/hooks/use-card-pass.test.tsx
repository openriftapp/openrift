import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PassDismiss } from "@/features/catalog-workspace/lib/card-pass";
import type { WorkspaceUndoEntry } from "@/features/catalog-workspace/lib/workspace-undo";

function mutation() {
  return {
    mutateAsync: vi.fn(async (_input: unknown, _options?: unknown) => {}),
    isPending: false,
  };
}

const mocks = vi.hoisted(() => ({
  checkCards: { current: null as ReturnType<typeof mutation> | null },
  checkPrintings: { current: null as ReturnType<typeof mutation> | null },
  uncheckCandidateCardsFn: vi.fn((_input: unknown) => Promise.resolve()),
  uncheckCandidatePrintingsFn: vi.fn((_input: unknown) => Promise.resolve()),
  push: vi.fn((_entry: unknown) => {}),
}));

vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  acceptCardFieldFn: vi.fn(),
  useAcceptCardField: vi.fn(),
  useAcceptPrintingGroup: vi.fn(),
  uncheckCandidateCardsFn: mocks.uncheckCandidateCardsFn,
  uncheckCandidatePrintingsFn: mocks.uncheckCandidatePrintingsFn,
  useCheckCandidateCards: () => mocks.checkCards.current,
  useCheckAllCandidatePrintings: () => mocks.checkPrintings.current,
}));
vi.mock("@/features/admin/hooks/use-catalog-review", () => ({
  useAcceptSubmission: vi.fn(),
}));
vi.mock("@/features/catalog-workspace/hooks/use-workspace-undo", () => ({
  useWorkspaceUndo: () => ({ push: mocks.push }),
}));

const { usePassDismiss } = await import("./use-card-pass");

const RECORD = "Jinx, Demolitionist";
const { signal } = new AbortController();

beforeEach(() => {
  mocks.checkCards.current = mutation();
  mocks.checkPrintings.current = mutation();
  mocks.uncheckCandidateCardsFn.mockClear();
  mocks.uncheckCandidatePrintingsFn.mockClear();
  mocks.push.mockClear();
});

function renderDismiss(dismiss: PassDismiss) {
  return renderHook(() =>
    usePassDismiss({ cardSlug: "jinx", cardId: "card-1", record: RECORD, dismiss }),
  );
}

function pushed(): WorkspaceUndoEntry {
  expect(mocks.push).toHaveBeenCalledOnce();
  return mocks.push.mock.calls[0]?.[0] as WorkspaceUndoEntry;
}

describe("usePassDismiss", () => {
  it("checks card and printing rows and pushes one undo for both", async () => {
    const { result } = renderDismiss({
      candidateCardIds: ["cc-1", "cc-2"],
      candidatePrintingIds: ["cp-1"],
      suggestions: 4,
    });

    await act(() => result.current.run(signal));

    expect(mocks.checkCards.current?.mutateAsync).toHaveBeenCalledWith(
      { cardId: "card-1", candidateCardIds: ["cc-1", "cc-2"] },
      { signal },
    );
    expect(mocks.checkPrintings.current?.mutateAsync).toHaveBeenCalledWith(
      { extraIds: ["cp-1"] },
      { signal },
    );
    const entry = pushed();
    expect(entry.label).toBe(`Dismissed 4 suggestions on ${RECORD}`);
    await entry.undo(signal);
    expect(mocks.uncheckCandidateCardsFn).toHaveBeenCalledWith({
      data: { candidateCardIds: ["cc-1", "cc-2"] },
      signal,
    });
    expect(mocks.uncheckCandidatePrintingsFn).toHaveBeenCalledWith({
      data: { candidatePrintingIds: ["cp-1"] },
      signal,
    });
  });

  it("rejects when the printings check fails but still pushes an undo for the card rows", async () => {
    mocks.checkPrintings.current?.mutateAsync.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderDismiss({
      candidateCardIds: ["cc-1", "cc-2"],
      candidatePrintingIds: ["cp-1"],
      suggestions: 4,
    });

    await act(async () => {
      await expect(result.current.run(signal)).rejects.toThrow("offline");
    });

    const entry = pushed();
    expect(entry.label).toBe(`Dismissed 2 sources on ${RECORD}`);
    await entry.undo(signal);
    expect(mocks.uncheckCandidateCardsFn).toHaveBeenCalledOnce();
    expect(mocks.uncheckCandidatePrintingsFn).not.toHaveBeenCalled();
  });

  it("pushes no undo when there is nothing to dismiss", async () => {
    const { result } = renderDismiss({
      candidateCardIds: [],
      candidatePrintingIds: [],
      suggestions: 0,
    });

    await act(() => result.current.run(signal));

    expect(mocks.checkCards.current?.mutateAsync).not.toHaveBeenCalled();
    expect(mocks.checkPrintings.current?.mutateAsync).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
