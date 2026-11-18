import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildAttentionSubmissions } from "@/features/admin/lib/attention-items";
import { buildCardSuggestions } from "@/features/catalog-workspace/lib/suggestion-rows";
import { resetWorkspaceWriteQueue } from "@/features/catalog-workspace/lib/workspace-write-queue";
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
  checkMany: fakeMutation(),
  acceptSubmission: fakeMutation(),
};

const serverFns = vi.hoisted(() => ({
  acceptCardField: vi.fn((_input: unknown) => Promise.resolve()),
  uncheckCandidateCards: vi.fn((_input: unknown) => Promise.resolve()),
}));

const realCheck = vi.hoisted(() => ({
  fn: null as ((candidateCardId: string) => Promise<void>) | null,
}));

vi.mock("@/features/admin/hooks/use-admin-card-mutations", async () => {
  const { useMutation } = await import("@tanstack/react-query");
  return {
    acceptCardFieldFn: serverFns.acceptCardField,
    uncheckCandidateCardsFn: serverFns.uncheckCandidateCards,
    useAcceptCardField: () => mutations.acceptCardField,
    useCheckCandidateCard: () => {
      const real = useMutation({
        mutationFn: (candidateCardId: string) =>
          realCheck.fn?.(candidateCardId) ?? Promise.resolve(),
      });
      return realCheck.fn === null ? mutations.check : real;
    },
    useCheckCandidateCards: () => mutations.checkMany,
  };
});

vi.mock("@/features/admin/hooks/use-catalog-review", () => ({
  useAcceptSubmission: () => mutations.acceptSubmission,
}));

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn() }) }));

const { useCardRecordActions } = await import("./use-card-record-actions");

let resetStore: () => void;

beforeEach(() => {
  resetIdCounter();
  resetStore = createStoreResetter(useWorkspaceSelectionStore);
  mutations.acceptCardField = fakeMutation();
  mutations.acceptCardField.mutateAsync.mockResolvedValue({ written: true });
  mutations.check = fakeMutation();
  mutations.checkMany = fakeMutation();
  mutations.acceptSubmission = fakeMutation();
  serverFns.acceptCardField.mockClear();
  serverFns.uncheckCandidateCards.mockClear();
  realCheck.fn = null;
  vi.mocked(toast.success).mockClear();
});

afterEach(() => {
  resetWorkspaceWriteQueue();
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
  return renderHook(
    () => useCardRecordActions({ cardSlug: "jinx", detail, model, submissions, canCheck }),
    { wrapper },
  );
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

function latest() {
  return useWorkspaceSelectionStore.getState().undoStack.at(-1);
}

const { signal } = new AbortController();

describe("useCardRecordActions", () => {
  it("Use writes the source value and pushes an undo that restores the old one", async () => {
    const { result } = setup([source({ might: 3 })]);

    act(() => {
      void result.current.actions.useSuggestion?.(signal, 1);
    });

    expect(mutations.acceptCardField.mutateAsync).toHaveBeenCalledWith(
      {
        cardId: card.id,
        field: "might",
        value: 3,
        source: "provider",
      },
      { signal: expect.any(AbortSignal) },
    );
    await vi.waitFor(() => expect(latest()).toBeDefined());
    expect(latest()?.label).toBe("Used Might from scans on Jinx, Demolitionist");
    expect(latest()?.undoneLabel).toBe("Undone: Might restored on Jinx, Demolitionist");
    await latest()?.undo(signal);
    expect(serverFns.acceptCardField).toHaveBeenCalledWith({
      data: { cardId: card.id, field: "might", value: 4, source: "manual", expected: 3 },
      signal,
    });
  });

  it("toast Undo removes its own entry, not the newest, and runs once", async () => {
    const { result } = setup([source({ might: 3 })]);
    act(() => {
      void result.current.actions.useSuggestion?.(signal, 1);
    });
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalled());
    const [[, options]] = vi.mocked(toast.success).mock.calls.slice(-1) as unknown as [
      [string, { action: { onClick: () => void } }],
    ];
    const later = {
      label: "Later step",
      undoneLabel: "Undone: later step",
      invalidates: [],
      undo: vi.fn(() => Promise.resolve()),
    };
    useWorkspaceSelectionStore.getState().pushUndo(later);

    options.action.onClick();
    options.action.onClick();

    await vi.waitFor(() =>
      expect(useWorkspaceSelectionStore.getState().undoStack).toEqual([later]),
    );
    expect(serverFns.acceptCardField).toHaveBeenCalledOnce();
    expect(later.undo).not.toHaveBeenCalled();
  });

  it("runs two discards clicked before either lands one after the other and pushes an undo for each", async () => {
    const first = source({ might: 3, name: "Jinx A" });
    const second = source({ provider: "gallery", might: 2, name: "Jinx B" });
    const gates: (() => void)[] = [];
    realCheck.fn = () =>
      new Promise<void>((resolve) => {
        gates.push(resolve);
      });
    const { result } = setup([first, second]);
    const model = buildCardSuggestions(
      makeAdminCardDetail({ card, sources: [first, second] }),
      [],
      [],
    );
    const [a, b] = model.suggestions.filter(
      (suggestion, index, all) =>
        all.findIndex((other) => other.candidateRowId === suggestion.candidateRowId) === index,
    );
    if (a === undefined || b === undefined) {
      throw new Error("expected two suggestions");
    }

    let runs: Promise<boolean>[] = [];
    act(() => {
      runs = [result.current.discardSuggestion(a), result.current.discardSuggestion(b)];
    });
    await vi.waitFor(() => expect(gates).toHaveLength(1));
    await act(async () => gates[0]?.());
    await vi.waitFor(() => expect(gates).toHaveLength(2));
    gates[1]?.();
    await act(() => Promise.all(runs));

    expect(useWorkspaceSelectionStore.getState().undoStack).toHaveLength(2);
  });

  it("Discard checks that source's row and undo unchecks it", async () => {
    const row = source({ might: 3, name: "Jinx A" });
    const { result } = setup([row]);
    const model = buildCardSuggestions(makeAdminCardDetail({ card, sources: [row] }), [], []);
    const first = model.suggestions[0];
    if (first === undefined) {
      throw new Error("expected a suggestion");
    }
    await act(() => result.current.discardSuggestion(first));

    expect(mutations.check.mutateAsync).toHaveBeenCalledWith(row.id, {
      signal: expect.any(AbortSignal),
    });
    expect(latest()?.label).toBe("Discarded 2 suggestions on Jinx, Demolitionist");
    await latest()?.undo(signal);
    expect(serverFns.uncheckCandidateCards).toHaveBeenCalledWith({
      data: { candidateCardIds: [row.id] },
      signal,
    });
  });

  it("Enter checks every open source row in one call, never a contributor row", async () => {
    const changed = source({ provider: "scans", might: 3 });
    const quiet = source({ provider: "gallery" });
    const { result } = setup([changed, quiet]);

    expect(result.current.actions.primary?.label).toBe("Discard 1 & next");
    expect(result.current.actions.primary?.disabled).toBe(false);
    await act(() => result.current.actions.primary?.run(signal));

    expect(mutations.checkMany.mutateAsync).toHaveBeenCalledOnce();
    expect(mutations.checkMany.mutateAsync).toHaveBeenCalledWith(
      {
        cardId: card.id,
        candidateCardIds: [changed.id, quiet.id],
      },
      { signal: expect.any(AbortSignal) },
    );
    expect(mutations.check.mutateAsync).not.toHaveBeenCalled();
    expect(useWorkspaceSelectionStore.getState().undoStack).toHaveLength(1);
    expect(latest()?.label).toBe("Discarded 1 suggestion on Jinx, Demolitionist");
    await latest()?.undo(signal);
    expect(serverFns.uncheckCandidateCards.mock.calls).toEqual([
      [{ data: { candidateCardIds: [changed.id, quiet.id] }, signal }],
    ]);
  });

  it("pushes no entry when Enter's discard fails", async () => {
    const { result } = setup([source({ might: 3 })]);
    mutations.checkMany.mutateAsync.mockRejectedValueOnce(new Error("offline"));

    await act(async () => {
      await expect(result.current.actions.primary?.run(signal)).rejects.toThrow("offline");
    });

    expect(useWorkspaceSelectionStore.getState().undoStack).toEqual([]);
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
    await act(() => result.current.actions.primary?.run(signal));
    expect(mutations.checkMany.mutateAsync).not.toHaveBeenCalled();

    const model = buildCardSuggestions(
      makeAdminCardDetail({ card, sources: [source({ might: 3 })] }),
      [],
      [],
    );
    const first = model.suggestions[0];
    if (first !== undefined) {
      await act(() => result.current.discardSuggestion(first));
    }
    expect(mutations.check.mutateAsync).not.toHaveBeenCalled();
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

    act(() => {
      void result.current.actions.useSuggestion?.(signal, 1);
    });

    expect(mutations.acceptSubmission.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateCardId: "sub-1",
        cardFields: [{ field: "might", value: 2 }],
      }),
      { signal: expect.any(AbortSignal) },
    );
    expect(useWorkspaceSelectionStore.getState().undoStack).toEqual([]);
  });

  it("ignores a hotkey with no suggestion", () => {
    const { result } = setup([source()]);
    act(() => {
      void result.current.actions.useSuggestion?.(signal, 4);
    });
    expect(mutations.acceptCardField.mutateAsync).not.toHaveBeenCalled();
  });
});
