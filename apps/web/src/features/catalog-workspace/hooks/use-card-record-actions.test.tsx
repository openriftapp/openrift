import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildAttentionSubmissions } from "@/features/admin/lib/attention-items";
import type {
  CardSuggestions,
  FieldSuggestion,
} from "@/features/catalog-workspace/lib/suggestion-rows";
import { buildCardSuggestions } from "@/features/catalog-workspace/lib/suggestion-rows";
import { resetWorkspaceWriteQueue } from "@/features/catalog-workspace/lib/workspace-write-queue";
import { useWorkspaceUndoStore } from "@/features/catalog-workspace/stores/workspace-undo-store";
import {
  makeAdminCard,
  makeAdminCardDetail,
  makeCandidateCard,
  resetIdCounter,
} from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

interface FakeMutation {
  mutateAsync: ReturnType<typeof vi.fn>;
  isPending: boolean;
}

function fakeMutation(): FakeMutation {
  return { mutateAsync: vi.fn(() => Promise.resolve()), isPending: false };
}

const mutations = {
  acceptCardField: fakeMutation(),
  acceptSubmission: fakeMutation(),
};

const serverFns = vi.hoisted(() => ({
  acceptCardField: vi.fn((_input: unknown) => Promise.resolve()),
}));

vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  acceptCardFieldFn: serverFns.acceptCardField,
  useAcceptCardField: () => mutations.acceptCardField,
}));

vi.mock("@/features/admin/hooks/use-catalog-review", () => ({
  useAcceptSubmission: () => mutations.acceptSubmission,
}));

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn() }) }));

const { useCardRecordActions } = await import("./use-card-record-actions");

let resetStore: () => void;

beforeEach(() => {
  resetIdCounter();
  resetStore = createStoreResetter(useWorkspaceUndoStore);
  mutations.acceptCardField = fakeMutation();
  mutations.acceptCardField.mutateAsync.mockResolvedValue({ written: true });
  mutations.acceptSubmission = fakeMutation();
  serverFns.acceptCardField.mockClear();
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

function setup(sources: ReturnType<typeof makeCandidateCard>[]) {
  const detail = makeAdminCardDetail({ card, sources });
  const submissions = buildAttentionSubmissions(detail, []);
  const model = buildCardSuggestions(detail, submissions);
  const hook = renderHook(() => useCardRecordActions({ cardSlug: "jinx", detail, submissions }), {
    wrapper,
  });
  return { ...hook, model };
}

function mightSuggestion(model: CardSuggestions): FieldSuggestion {
  const suggestion = model.rows
    .flatMap((row) => row.suggestions)
    .find((entry) => entry.field === "might");
  if (suggestion === undefined) {
    throw new Error("expected a Might suggestion");
  }
  return suggestion;
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

function latest() {
  return useWorkspaceUndoStore.getState().undoStack.at(-1);
}

const { signal } = new AbortController();

describe("useCardRecordActions", () => {
  it("Use writes the source value and pushes an undo that restores the old one", async () => {
    const { result, model } = setup([source({ might: 3 })]);

    act(() => {
      void result.current.apply(mightSuggestion(model));
    });

    await vi.waitFor(() =>
      expect(mutations.acceptCardField.mutateAsync).toHaveBeenCalledWith(
        {
          cardId: card.id,
          field: "might",
          value: 3,
          source: "provider",
        },
        { signal: expect.any(AbortSignal) },
      ),
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
    const { result, model } = setup([source({ might: 3 })]);
    act(() => {
      void result.current.apply(mightSuggestion(model));
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
    useWorkspaceUndoStore.getState().pushUndo(later);

    options.action.onClick();
    options.action.onClick();

    await vi.waitFor(() => expect(useWorkspaceUndoStore.getState().undoStack).toEqual([later]));
    expect(serverFns.acceptCardField).toHaveBeenCalledOnce();
    expect(later.undo).not.toHaveBeenCalled();
  });

  it("Use on a contributor chip accepts only that change of the submission", async () => {
    const submission = makeCandidateCard({
      ...source(),
      id: "sub-1",
      provider: "usersubmission",
      might: 2,
      energy: 9,
    });
    const { result, model } = setup([submission]);

    await act(() => result.current.apply(mightSuggestion(model)));

    expect(mutations.acceptSubmission.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateCardId: "sub-1",
        cardFields: [{ field: "might", value: 2 }],
      }),
      { signal: expect.any(AbortSignal) },
    );
    expect(useWorkspaceUndoStore.getState().undoStack).toEqual([]);
  });
});
