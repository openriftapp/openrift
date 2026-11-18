import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWorkspaceActionsStore } from "@/features/catalog-workspace/stores/workspace-actions-store";
import {
  makeAdminCard,
  makeAdminCardDetail,
  makeCandidateCard,
  makeCandidatePrinting,
} from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

interface FakeMutation {
  isPending: boolean;
  mutateAsync: ReturnType<typeof vi.fn>;
}

function fakeMutation(): FakeMutation {
  return { isPending: false, mutateAsync: vi.fn(() => Promise.resolve()) };
}

const QUEUE_KEY = ["admin", "workspace", "queue", "all"];

const state = vi.hoisted(() => ({
  detail: undefined as object | undefined,
  queue: { items: [] } as object,
  accept: null as unknown as FakeMutation,
  ignore: null as unknown as FakeMutation,
  desk: null as unknown as FakeMutation,
  goNext: vi.fn(),
}));

vi.mock("@/features/catalog-workspace/lib/workspace-queries", () => ({
  workspaceQueueQueryOptions: () => ({
    queryKey: ["admin", "workspace", "queue", "all"],
    queryFn: () => state.queue,
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: unknown }) => children,
}));
vi.mock("@/features/admin/hooks/use-admin", () => ({
  useAdminAccess: () => ({ data: { isAdmin: true } }),
}));
vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  useAcceptPrintingGroup: () => state.accept,
  useLinkCandidatePrintings: () => fakeMutation(),
}));
vi.mock("@/features/admin/hooks/use-admin-card-queries", () => ({
  useAdminCardDetail: () => ({ data: state.detail, isError: false }),
}));
vi.mock("@/features/admin/hooks/use-admin-image-mutations", () => ({
  useAddImageFromUrl: () => fakeMutation(),
  useUploadPrintingImage: () => fakeMutation(),
}));
vi.mock("@/features/admin/hooks/use-ignored-candidates", () => ({
  useIgnoreCandidatePrinting: () => state.ignore,
}));
vi.mock("@/features/admin/hooks/use-printing-desk", () => ({
  useUpdateDeskPrinting: () => state.desk,
}));
vi.mock("@/features/admin/hooks/use-provider-settings", () => ({
  useProviderSettings: () => ({ data: { providerSettings: [] } }),
}));
vi.mock("@/features/cards/hooks/use-sets", () => ({ useSets: () => ({ data: { sets: [] } }) }));
vi.mock("@/features/catalog-workspace/hooks/use-face-record-actions", () => ({
  useValueLabels: () => ({}),
}));
vi.mock("@/features/catalog-workspace/hooks/use-queue-navigation", () => ({
  useQueueNavigation: () => ({ goNext: state.goNext, skipToEnd: vi.fn() }),
}));
vi.mock("@/features/catalog-workspace/hooks/use-workspace-undo", () => ({
  useWorkspaceUndo: () => ({ announce: vi.fn() }),
}));
vi.mock("@/features/catalog-workspace/components/creation/creation-panel", () => ({
  CreationPanel: () => null,
}));
vi.mock("@/features/catalog-workspace/lib/creation-draft", () => ({
  draftFromCandidatePrinting: () => ({ candidatePrintingIds: [] }),
  duplicateProbeFromAdminPrinting: () => ({}),
  findDuplicateCandidates: () => [],
  plannedImageUploads: () => [],
  printingFollowUpFields: () => ({ comment: "From the launch event" }),
  toAcceptInput: () => ({}),
  validateDraft: () => [],
}));

const { NewPrintingRecord } = await import("./new-printing-record");

const card = makeAdminCard({ slug: "ekko", name: "Ekko, Recurrent" });
const source = makeCandidateCard({ provider: "gallery", name: card.name });
const candidate = makeCandidatePrinting({ candidateCardId: source.id });

function queueWith(ids: readonly string[]) {
  return {
    items: ids.map((id) => ({ owner: "printing", ownerId: id, cardSlug: card.slug })),
  };
}

function renderRecord() {
  const client = new QueryClient();
  state.queue = queueWith([candidate.id]);
  client.setQueryData(QUEUE_KEY, state.queue);
  render(
    <QueryClientProvider client={client}>
      <NewPrintingRecord candidatePrintingId={candidate.id} />
    </QueryClientProvider>,
  );
  return client;
}

let resetActions: () => void;

beforeEach(() => {
  resetActions = createStoreResetter(useWorkspaceActionsStore);
  state.detail = makeAdminCardDetail({
    card,
    sources: [source],
    candidatePrintings: [candidate],
  });
  state.accept = fakeMutation();
  state.ignore = fakeMutation();
  state.desk = fakeMutation();
  state.goNext.mockClear();
});

afterEach(() => {
  resetActions();
});

describe("NewPrintingRecord", () => {
  it("shows its loading state, not the accept form, while its own ignore runs", async () => {
    state.ignore.isPending = true;
    renderRecord();

    await waitFor(() => expect(useWorkspaceActionsStore.getState().actions?.loading).toBe(true));
    expect(screen.queryByRole("button", { name: /Accept & next/u })).toBeNull();
    expect(useWorkspaceActionsStore.getState().actions?.accept).toBeUndefined();
  });

  it("stays on the record and says what did not save when the queue drops the candidate mid-accept", async () => {
    const client = renderRecord();
    const gate = { created: () => {} };
    state.accept.mutateAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          gate.created = () => resolve({ printingId: "printing-1" });
        }),
    );
    state.desk.mutateAsync.mockRejectedValue(new Error("Network down"));

    const acceptButton = await screen.findByRole("button", { name: /Accept & next/u });
    act(() => acceptButton.click());
    await waitFor(() => expect(state.accept.mutateAsync).toHaveBeenCalledOnce());
    state.detail = makeAdminCardDetail({ card, sources: [source], candidatePrintings: [] });
    state.queue = queueWith([]);
    act(() => {
      client.setQueryData(QUEUE_KEY, state.queue);
    });
    await act(async () => gate.created());

    expect(
      await screen.findByText("The printing was created, but the dates and note did not save."),
    ).toBeVisible();
    expect(screen.queryByText(/not in the queue any more/u)).toBeNull();
    expect(state.goNext).not.toHaveBeenCalled();
    expect(useWorkspaceActionsStore.getState().actions?.accept).toBeUndefined();
  });
});
