import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildAttentionSubmissions } from "@/features/admin/lib/attention-items";
import { buildCardSuggestions } from "@/features/catalog-workspace/lib/suggestion-rows";
import { useWorkspaceSelectionStore } from "@/features/catalog-workspace/stores/workspace-selection-store";
import {
  makeAdminCard,
  makeAdminCardDetail,
  makeCandidateCard,
  resetIdCounter,
} from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

interface FakeMutation {
  mutate: ReturnType<typeof vi.fn>;
  mutateAsync: ReturnType<typeof vi.fn>;
  isPending: boolean;
}

function fakeMutation(): FakeMutation {
  return {
    mutate: vi.fn((_input: unknown, options?: { onSuccess?: (data: unknown) => void }) =>
      options?.onSuccess?.({ applied: 1, skipped: [] }),
    ),
    mutateAsync: vi.fn(() => Promise.resolve()),
    isPending: false,
  };
}

const mutations = {
  acceptCardField: fakeMutation(),
  check: fakeMutation(),
  uncheck: fakeMutation(),
  acceptSubmission: fakeMutation(),
};

vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  useAcceptCardField: () => mutations.acceptCardField,
  useCheckCandidateCard: () => mutations.check,
  useUncheckCandidateCard: () => mutations.uncheck,
}));

vi.mock("@/features/admin/hooks/use-catalog-review", () => ({
  useAcceptSubmission: () => mutations.acceptSubmission,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const { primaryLabel, useCardRecordActions } = await import("./use-card-record-actions");

let resetStore: () => void;

beforeEach(() => {
  resetIdCounter();
  resetStore = createStoreResetter(useWorkspaceSelectionStore);
  mutations.acceptCardField = fakeMutation();
  mutations.check = fakeMutation();
  mutations.uncheck = fakeMutation();
  mutations.acceptSubmission = fakeMutation();
});

afterEach(() => {
  resetStore();
});

const card = makeAdminCard({ name: "Jinx, Demolitionist", slug: "jinx", might: 4 });

function source(overrides: Parameters<typeof makeCandidateCard>[0] = {}) {
  return makeCandidateCard({
    provider: "scans",
    name: card.name,
    types: card.types,
    domains: card.domains,
    might: card.might,
    energy: card.energy,
    power: card.power,
    ...overrides,
  });
}

function setup(sources: ReturnType<typeof makeCandidateCard>[], canCheck = true) {
  const detail = makeAdminCardDetail({ card, sources });
  const submissions = buildAttentionSubmissions(detail, []);
  const model = buildCardSuggestions(detail, [], submissions);
  return renderHook(() =>
    useCardRecordActions({ cardSlug: "jinx", detail, model, submissions, canCheck }),
  );
}

describe("useCardRecordActions", () => {
  it("Use writes the source value and pushes an undo that restores the old one", async () => {
    const { result } = setup([source({ might: 3 })]);

    act(() => result.current.actions.useSuggestion?.(1));

    expect(mutations.acceptCardField.mutate).toHaveBeenCalledWith(
      { cardId: card.id, field: "might", value: 3, source: "provider" },
      expect.anything(),
    );
    const entry = useWorkspaceSelectionStore.getState().popUndo();
    await entry?.undo();
    expect(mutations.acceptCardField.mutateAsync).toHaveBeenCalledWith({
      cardId: card.id,
      field: "might",
      value: 4,
      source: "manual",
    });
  });

  it("toast Undo removes its own entry, not the newest, and runs once", async () => {
    const { result } = setup([source({ might: 3 })]);
    act(() => result.current.actions.useSuggestion?.(1));
    const [[, options]] = vi.mocked(toast.success).mock.calls.slice(-1) as unknown as [
      [string, { action: { onClick: () => void } }],
    ];
    const later = { label: "Later step", undo: vi.fn(() => Promise.resolve()) };
    useWorkspaceSelectionStore.getState().pushUndo(later);

    options.action.onClick();
    options.action.onClick();

    expect(useWorkspaceSelectionStore.getState().undoStack).toEqual([later]);
    expect(mutations.acceptCardField.mutateAsync).toHaveBeenCalledOnce();
    expect(later.undo).not.toHaveBeenCalled();
  });

  it("Discard checks that source's row and undo unchecks it", async () => {
    const row = source({ might: 3, name: "Jinx A" });
    const { result } = setup([row]);
    const model = buildCardSuggestions(makeAdminCardDetail({ card, sources: [row] }), [], []);
    const first = model.suggestions[0];
    if (first === undefined) {
      throw new Error("expected a suggestion");
    }
    act(() => result.current.discardSuggestion(first));

    expect(mutations.check.mutate).toHaveBeenCalledWith(row.id, expect.anything());
    await useWorkspaceSelectionStore.getState().popUndo()?.undo();
    expect(mutations.uncheck.mutateAsync).toHaveBeenCalledWith(row.id);
  });

  it("Enter checks every open source row but never a contributor row", async () => {
    const changed = source({ provider: "scans", might: 3 });
    const quiet = source({ provider: "gallery" });
    const { result } = setup([changed, quiet]);

    expect(result.current.actions.primary?.label).toBe("Discard 1 & next");
    expect(result.current.actions.primary?.disabled).toBe(false);
    await act(() => result.current.actions.primary?.run());

    expect(mutations.check.mutateAsync.mock.calls.map((call) => call[0])).toEqual([
      changed.id,
      quiet.id,
    ]);
    expect(useWorkspaceSelectionStore.getState().undoStack).toHaveLength(1);
  });

  it("disables Enter while a contributor proposal is open", () => {
    const { result } = setup([
      source({ might: 3 }),
      makeCandidateCard({ ...source(), provider: "usersubmission", might: 2 }),
    ]);

    expect(result.current.contributorOpen).toBe(true);
    expect(result.current.actions.primary?.disabled).toBe(true);
  });

  it("disables Next for users who cannot check while a contributor proposal is open", () => {
    const { result } = setup(
      [makeCandidateCard({ ...source(), provider: "usersubmission", might: 2 })],
      false,
    );

    expect(result.current.actions.primary?.label).toBe("Next");
    expect(result.current.actions.primary?.disabled).toBe(true);
  });

  it("gives plain Next to users who cannot check", async () => {
    const { result } = setup([source({ might: 3 })], false);

    expect(result.current.actions.primary?.label).toBe("Next");
    await act(() => result.current.actions.primary?.run());
    expect(mutations.check.mutateAsync).not.toHaveBeenCalled();

    const model = buildCardSuggestions(
      makeAdminCardDetail({ card, sources: [source({ might: 3 })] }),
      [],
      [],
    );
    const first = model.suggestions[0];
    if (first !== undefined) {
      act(() => result.current.discardSuggestion(first));
    }
    expect(mutations.check.mutate).not.toHaveBeenCalled();
  });

  it("Use on a contributor chip accepts only that change of the submission", () => {
    const submission = makeCandidateCard({
      ...source(),
      id: "sub-1",
      provider: "usersubmission",
      might: 2,
      energy: 9,
    });
    const { result } = setup([submission]);

    act(() => result.current.actions.useSuggestion?.(1));

    expect(mutations.acceptSubmission.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateCardId: "sub-1",
        cardFields: [{ field: "might", value: 2 }],
      }),
      expect.anything(),
    );
    expect(useWorkspaceSelectionStore.getState().undoStack).toEqual([]);
  });

  it("ignores a hotkey with no suggestion", () => {
    const { result } = setup([source()]);
    act(() => result.current.actions.useSuggestion?.(4));
    expect(mutations.acceptCardField.mutate).not.toHaveBeenCalled();
  });
});

describe("primaryLabel", () => {
  it("falls back to Next without differences", () => {
    expect(primaryLabel(null, true)).toBe("Next");
  });
});
