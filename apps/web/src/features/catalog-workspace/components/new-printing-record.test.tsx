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

const OPEN_KEY = ["admin", "workspace", "candidate-printing-card", "candidate"];

const RECORD_PATH = "/admin/workspace/printings/new/candidate";

const state = vi.hoisted(() => ({
  detail: undefined as object | undefined,
  open: { cardSlug: null } as object,
  accept: null as unknown as FakeMutation,
  ignore: null as unknown as FakeMutation,
  desk: null as unknown as FakeMutation,
  navigate: vi.fn(),
  followUpMeta: [] as unknown[],
}));

vi.mock("@/features/catalog-workspace/lib/workspace-queries", () => ({
  candidatePrintingCardQueryOptions: () => ({
    queryKey: ["admin", "workspace", "candidate-printing-card", "candidate"],
    queryFn: () => state.open,
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: unknown }) => children,
  useNavigate: () => state.navigate,
  useRouter: () => ({
    latestLocation: {
      pathname: RECORD_PATH,
      state: { workspaceReview: { cardSlug: "trail-card", queue: "review", cardIndex: 0 } },
    },
  }),
  useRouterState: () => RECORD_PATH,
}));
vi.mock("@/features/admin/hooks/use-admin", () => ({
  useAdminAccess: () => ({ data: { isAdmin: true } }),
}));
vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  useAcceptPrintingGroup: () => state.accept,
  useAcceptPrintingGroups: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useLinkCandidatePrintings: () => fakeMutation(),
}));
vi.mock("@/features/admin/hooks/use-admin-card-queries", () => ({
  useAdminCardDetail: () => ({ data: state.detail, isError: false }),
}));
vi.mock("@/features/admin/hooks/use-admin-image-mutations", () => ({
  useAddImageFromUrl: (_scope: unknown, meta?: unknown) => {
    state.followUpMeta.push(meta);
    return fakeMutation();
  },
  useUploadPrintingImage: (_scope: unknown, meta?: unknown) => {
    state.followUpMeta.push(meta);
    return fakeMutation();
  },
}));
vi.mock("@/features/admin/hooks/use-ignored-candidates", () => ({
  useIgnoreCandidatePrinting: () => state.ignore,
}));
vi.mock("@/features/admin/hooks/use-printing-desk", () => ({
  useUpdateDeskPrinting: (meta?: unknown) => {
    state.followUpMeta.push(meta);
    return state.desk;
  },
}));
vi.mock("@/features/admin/hooks/use-provider-settings", () => ({
  useProviderSettings: () => ({ data: { providerSettings: [] } }),
}));
vi.mock("@/features/cards/hooks/use-sets", () => ({ useSets: () => ({ data: { sets: [] } }) }));
vi.mock("@/features/catalog-workspace/hooks/use-value-labels", () => ({
  useValueLabels: () => ({}),
}));
vi.mock("@/features/catalog-workspace/hooks/use-workspace-undo", () => ({
  useWorkspaceUndo: () => ({ announce: vi.fn() }),
}));
vi.mock("@/features/catalog-workspace/components/creation/creation-panel", () => ({
  CreationPanel: ({
    onMergeDuplicate,
  }: {
    onMergeDuplicate?: (duplicate: { printingId: string }) => void;
  }) =>
    onMergeDuplicate ? (
      <button type="button" onClick={() => onMergeDuplicate({ printingId: "printing-9" })}>
        Merge duplicate
      </button>
    ) : null,
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

function openOn(cardSlug: string | null) {
  return { cardSlug };
}

function renderRecord() {
  const client = new QueryClient();
  state.open = openOn(card.slug);
  client.setQueryData(OPEN_KEY, state.open);
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
  state.navigate.mockClear();
  state.followUpMeta = [];
});

afterEach(() => {
  resetActions();
});

describe("NewPrintingRecord", () => {
  it("ignores every source row of the group, as the card pass does", async () => {
    const other = makeCandidateCard({ provider: "scans", name: card.name });
    const sibling = makeCandidatePrinting({ candidateCardId: other.id });
    state.detail = makeAdminCardDetail({
      card,
      sources: [source, other],
      candidatePrintings: [candidate, sibling],
      candidatePrintingGroups: [
        {
          mostCommonShortCode: candidate.shortCode,
          shortCodes: [candidate.id, sibling.id],
          expectedPrintingId: candidate.shortCode,
          language: "EN",
          suggestedPrintingId: null,
        },
      ],
    });
    renderRecord();

    await waitFor(() => expect(useWorkspaceActionsStore.getState().actions?.ignore).toBeDefined());
    await act(() =>
      useWorkspaceActionsStore.getState().actions?.ignore?.(new AbortController().signal),
    );

    expect(state.ignore.mutateAsync).toHaveBeenCalledTimes(2);
  });

  it("shows its loading state, not the accept form, while its own ignore runs", async () => {
    state.ignore.isPending = true;
    renderRecord();

    await waitFor(() => expect(useWorkspaceActionsStore.getState().actions?.loading).toBe(true));
    expect(screen.queryByRole("button", { name: /^Create/u })).toBeNull();
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

    const acceptButton = await screen.findByRole("button", { name: /^Create/u });
    act(() => acceptButton.click());
    await waitFor(() => expect(state.accept.mutateAsync).toHaveBeenCalledOnce());
    state.detail = makeAdminCardDetail({ card, sources: [source], candidatePrintings: [] });
    state.open = openOn(null);
    act(() => {
      client.setQueryData(OPEN_KEY, state.open);
    });
    await act(async () => gate.created());

    expect(
      await screen.findByText(
        "The printing was created, but the dates and note did not save: Network down.",
      ),
    ).toBeVisible();
    expect(screen.queryByText(/no longer open/u)).toBeNull();
    expect(state.navigate).not.toHaveBeenCalled();
    expect(useWorkspaceActionsStore.getState().actions?.accept).toBeUndefined();
  });

  it("reports failed follow-up writes inline only, not as a toast", async () => {
    renderRecord();
    await screen.findByRole("button", { name: /^Create/u });

    expect(state.followUpMeta.length).toBeGreaterThan(0);
    for (const meta of state.followUpMeta) {
      expect(meta).toEqual({ inlineError: true });
    }
  });

  it("stops offering the accept once the printing exists, even with the candidate still loaded", async () => {
    renderRecord();
    state.accept.mutateAsync.mockResolvedValue({ printingId: "printing-1" });
    state.desk.mutateAsync.mockRejectedValue(new Error("Network down"));

    const acceptButton = await screen.findByRole("button", { name: /^Create/u });
    await act(async () => acceptButton.click());

    expect(
      await screen.findByText(
        "The printing was created, but the dates and note did not save: Network down.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Create/u })).toBeNull();
    expect(useWorkspaceActionsStore.getState().actions?.accept).toBeUndefined();
    expect(useWorkspaceActionsStore.getState().actions?.ignore).toBeUndefined();
    expect(state.accept.mutateAsync).toHaveBeenCalledOnce();
  });

  it("opens the card's pass once the accept and its follow-up writes land", async () => {
    renderRecord();
    state.accept.mutateAsync.mockResolvedValue({ printingId: "printing-1" });

    const acceptButton = await screen.findByRole("button", { name: /^Create/u });
    await act(async () => acceptButton.click());

    await waitFor(() =>
      expect(state.navigate).toHaveBeenCalledExactlyOnceWith({
        to: "/admin/workspace/cards/$cardSlug",
        params: { cardSlug: card.slug },
        search: { queue: "review" },
      }),
    );
  });

  it("opens the card's pass after an ignore", async () => {
    renderRecord();

    const ignoreButton = await screen.findByRole("button", { name: /^Ignore/u });
    await act(async () => ignoreButton.click());

    await waitFor(() => expect(state.ignore.mutateAsync).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(state.navigate).toHaveBeenCalledExactlyOnceWith({
        to: "/admin/workspace/cards/$cardSlug",
        params: { cardSlug: card.slug },
        search: { queue: "review" },
      }),
    );
  });

  it("opens the card's pass after a merge into an existing printing", async () => {
    renderRecord();

    const mergeButton = await screen.findByRole("button", { name: "Merge duplicate" });
    await act(async () => mergeButton.click());

    await waitFor(() =>
      expect(state.navigate).toHaveBeenCalledExactlyOnceWith({
        to: "/admin/workspace/cards/$cardSlug",
        params: { cardSlug: card.slug },
        search: { queue: "review" },
      }),
    );
  });
});
