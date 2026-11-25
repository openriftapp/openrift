import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PassDismiss } from "@/features/catalog-workspace/lib/card-pass";
import type { CreationDraft } from "@/features/catalog-workspace/lib/creation-draft";
import type { WorkspaceUndoEntry } from "@/features/catalog-workspace/lib/workspace-undo";

function mutation() {
  return {
    mutateAsync: vi.fn(async (_input: unknown, _options?: unknown) => {}),
    isPending: false,
  };
}

const mocks = vi.hoisted(() => ({
  checkPass: { current: null as ReturnType<typeof mutation> | null },
  checkPrintings: { current: null as ReturnType<typeof mutation> | null },
  acceptGroups: { current: null as ReturnType<typeof mutation> | null },
  uncheckCandidateCardsFn: vi.fn((_input: unknown) => Promise.resolve()),
  uncheckCandidatePrintingsFn: vi.fn((_input: unknown) => Promise.resolve()),
  push: vi.fn((_entry: unknown) => {}),
  toAcceptInput: vi.fn((draft: { key: string }) => ({
    cardId: "card-1",
    printingFields: { shortCode: draft.key },
    candidatePrintingIds: [`cp-${draft.key}`],
  })),
}));

vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  acceptCardFieldFn: vi.fn(),
  useAcceptCardField: vi.fn(),
  uncheckCandidateCardsFn: mocks.uncheckCandidateCardsFn,
  uncheckCandidatePrintingsFn: mocks.uncheckCandidatePrintingsFn,
  useCheckPass: () => mocks.checkPass.current,
  useCheckAllCandidatePrintings: () => mocks.checkPrintings.current,
  useAcceptPrintingGroups: () => mocks.acceptGroups.current,
}));
vi.mock("@/features/admin/hooks/use-catalog-review", () => ({
  useAcceptSubmission: vi.fn(),
}));
vi.mock("@/features/catalog-workspace/hooks/use-workspace-undo", () => ({
  useWorkspaceUndo: () => ({ announce: mocks.push }),
}));
vi.mock("@/features/catalog-workspace/lib/creation-draft", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  toAcceptInput: mocks.toAcceptInput,
}));

const { usePassCreatePrinting, usePassDismiss } = await import("./use-card-pass");

const RECORD = "Jinx, Demolitionist";
const { signal } = new AbortController();

beforeEach(() => {
  mocks.checkPass.current = mutation();
  mocks.checkPrintings.current = mutation();
  mocks.acceptGroups.current = mutation();
  mocks.uncheckCandidateCardsFn.mockClear();
  mocks.uncheckCandidatePrintingsFn.mockClear();
  mocks.push.mockClear();
});

function renderDismiss(dismiss: PassDismiss) {
  return renderHook(() =>
    usePassDismiss({ scope: [["jinx"]], cardId: "card-1", record: RECORD, dismiss }),
  );
}

function pushed(): WorkspaceUndoEntry {
  expect(mocks.push).toHaveBeenCalledOnce();
  return mocks.push.mock.calls[0]?.[0] as WorkspaceUndoEntry;
}

describe("usePassDismiss", () => {
  it("checks only the printing rows when the page has no card", async () => {
    const { result } = renderHook(() =>
      usePassDismiss({
        scope: [["jinx"]],
        record: RECORD,
        dismiss: { candidateCardIds: [], candidatePrintingIds: ["cp-1"], suggestions: 1 },
      }),
    );

    await act(() => result.current.run(signal));

    expect(mocks.checkPass.current?.mutateAsync).not.toHaveBeenCalled();
    expect(mocks.checkPrintings.current?.mutateAsync).toHaveBeenCalledWith(
      { extraIds: ["cp-1"] },
      { signal },
    );
    await act(() => pushed().undo(signal));
    expect(mocks.uncheckCandidatePrintingsFn).toHaveBeenCalledOnce();
    expect(mocks.uncheckCandidateCardsFn).not.toHaveBeenCalled();
  });

  it("checks card and printing rows in one write and announces one undo for both", async () => {
    const { result } = renderDismiss({
      candidateCardIds: ["cc-1", "cc-2"],
      candidatePrintingIds: ["cp-1"],
      suggestions: 4,
    });

    await act(() => result.current.run(signal));

    expect(mocks.checkPass.current?.mutateAsync).toHaveBeenCalledOnce();
    expect(mocks.checkPass.current?.mutateAsync).toHaveBeenCalledWith(
      { cardId: "card-1", candidateCardIds: ["cc-1", "cc-2"], candidatePrintingIds: ["cp-1"] },
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

  it("undoes only the kinds of rows it checked", async () => {
    const { result } = renderDismiss({
      candidateCardIds: [],
      candidatePrintingIds: ["cp-1"],
      suggestions: 1,
    });

    await act(() => result.current.run(signal));
    await pushed().undo(signal);

    expect(mocks.uncheckCandidateCardsFn).not.toHaveBeenCalled();
    expect(mocks.uncheckCandidatePrintingsFn).toHaveBeenCalledOnce();
  });

  it("rejects and pushes no undo when the check fails", async () => {
    mocks.checkPass.current?.mutateAsync.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderDismiss({
      candidateCardIds: ["cc-1", "cc-2"],
      candidatePrintingIds: ["cp-1"],
      suggestions: 4,
    });

    await act(async () => {
      await expect(result.current.run(signal)).rejects.toThrow("offline");
    });

    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("pushes no undo when there is nothing to dismiss", async () => {
    const { result } = renderDismiss({
      candidateCardIds: [],
      candidatePrintingIds: [],
      suggestions: 0,
    });

    await act(() => result.current.run(signal));

    expect(mocks.checkPass.current?.mutateAsync).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});

describe("usePassCreatePrinting", () => {
  const drafts = [{ key: "OGN-001" }, { key: "OGN-002" }] as unknown as CreationDraft[];

  it("creates every draft in one request", async () => {
    const { result } = renderHook(() => usePassCreatePrinting("jinx"));

    await act(() => result.current.create(signal, drafts));

    expect(mocks.acceptGroups.current?.mutateAsync).toHaveBeenCalledOnce();
    expect(mocks.acceptGroups.current?.mutateAsync).toHaveBeenCalledWith(
      {
        cardId: "card-1",
        groups: [
          { printingFields: { shortCode: "OGN-001" }, candidatePrintingIds: ["cp-OGN-001"] },
          { printingFields: { shortCode: "OGN-002" }, candidatePrintingIds: ["cp-OGN-002"] },
        ],
      },
      { signal },
    );
  });

  it("sends nothing without drafts", async () => {
    const { result } = renderHook(() => usePassCreatePrinting("jinx"));

    await act(() => result.current.create(signal, []));

    expect(mocks.acceptGroups.current?.mutateAsync).not.toHaveBeenCalled();
  });
});
