import { emptyBoardDocument } from "@openrift/shared/board-state";
import type { BoardStateResponse } from "@openrift/shared/types/api/board-state";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type * as ReactRouter from "@tanstack/react-router";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBoardDraftStore } from "@/features/board-states/stores/board-draft-store";
import { useBoardEditorStore } from "@/features/board-states/stores/board-editor-store";
import { createStoreResetter } from "@/test/store-helpers";

import { BoardStateEditorPage, NewBoardStatePage } from "./board-state-editor-page";

const mutations = vi.hoisted(() => ({
  update: vi.fn<(body: unknown) => Promise<unknown>>(),
  create: vi.fn<(body: unknown) => Promise<{ id: string }>>(),
  navigate: vi.fn(async () => {}),
  onLeave: undefined as (() => void) | undefined,
  allowNavigation: undefined as
    | ((current: { pathname: string }, next: { pathname: string }) => boolean)
    | undefined,
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouter>()),
  useNavigate: () => mutations.navigate,
}));
vi.mock("@/components/unsaved-changes-guard", () => ({
  UnsavedChangesGuard: ({
    dirty,
    allowNavigation,
    onLeave,
  }: {
    dirty: boolean;
    onLeave?: () => void;
    allowNavigation?: (current: { pathname: string }, next: { pathname: string }) => boolean;
  }) => {
    mutations.allowNavigation = allowNavigation;
    mutations.onLeave = onLeave;
    return <output>{dirty ? "guard: blocking" : "guard: open"}</output>;
  },
}));
vi.mock("@/features/board-states/hooks/use-board-states", () => ({
  useUpdateBoardState: () => ({ mutateAsync: mutations.update, isPending: false }),
  useCreateBoardState: () => ({ mutateAsync: mutations.create, isPending: false }),
  useDeleteBoardState: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetBoardStateShare: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/features/board-states/components/board-state-editor-workspace", () => ({
  BoardWorkspace: () => null,
}));
vi.mock("@/features/board-states/components/board-editor-preview", () => ({
  BoardEditorPreview: () => null,
}));
vi.mock("@/features/board-states/components/board-editor-title-dialog", () => ({
  BoardEditorTitleDialog: () => null,
}));
vi.mock("@/features/board-states/components/board-editor-rules-popover", () => ({
  BoardEditorRulesPopover: ({
    onChange,
  }: {
    onChange: (pins: { coreRulesVersion: string | null; tournamentRulesVersion: null }) => void;
  }) => (
    <button
      type="button"
      onClick={() => onChange({ coreRulesVersion: "2.0", tournamentRulesVersion: null })}
    >
      Pin rules 2.0
    </button>
  ),
}));
vi.mock("@/features/rules/hooks/use-known-rules", () => ({
  useKnownRules: () => ({}),
  unknownRuleRefs: () => [],
}));
vi.mock("@/features/rules/lib/rules-queries", () => ({
  ruleVersionsQueryOptions: () => ({
    queryKey: ["rule-versions"],
    queryFn: () => ({ versions: [{ version: "1.0" }] }),
  }),
}));
vi.mock("@/hooks/use-hydrated", () => ({ useHydrated: () => true }));
vi.mock("@/hooks/use-session", () => ({ useUserId: () => "user-1" }));
vi.mock("@/lib/analytics", () => ({ trackAuthGate: vi.fn() }));

const BOARD_STATE: BoardStateResponse = {
  id: "board-1",
  title: "Summoner Skirmish turn 3",
  coreRulesVersion: "1.0",
  tournamentRulesVersion: null,
  document: emptyBoardDocument(),
  isPublic: false,
  shareToken: null,
  isFeatured: false,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
};

function deferred<T>() {
  let settle!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, resolve: settle };
}

function addUnit() {
  useBoardEditorStore.getState().addPiece({
    owner: "A",
    zone: { kind: "battlefield", index: 0 },
    kind: "unit",
    card: null,
  });
}

function renderWithClient(ui: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
}

let resetEditor: () => void;
let resetDraft: () => void;

beforeEach(() => {
  resetEditor = createStoreResetter(useBoardEditorStore);
  resetDraft = createStoreResetter(useBoardDraftStore);
  mutations.update.mockReset();
  mutations.create.mockReset();
  mutations.navigate.mockClear();
  mutations.allowNavigation = undefined;
  mutations.onLeave = undefined;
});

afterEach(() => {
  resetEditor();
  resetDraft();
});

describe("saved board editor", () => {
  it("marks the board saved when nothing changed during the request", async () => {
    mutations.update.mockResolvedValue(BOARD_STATE);
    renderWithClient(<BoardStateEditorPage boardState={BOARD_STATE} />);
    act(() => addUnit());

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));

    expect(screen.getByText("guard: open")).toBeInTheDocument();
  });

  it("keeps a board edit made during the save unsaved", async () => {
    const request = deferred<unknown>();
    mutations.update.mockReturnValue(request.promise);
    renderWithClient(<BoardStateEditorPage boardState={BOARD_STATE} />);
    act(() => addUnit());

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    act(() => addUnit());
    await act(async () => request.resolve(BOARD_STATE));

    expect(screen.getByText("guard: blocking")).toBeInTheDocument();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("keeps a rules pin changed during the save unsaved", async () => {
    const request = deferred<unknown>();
    mutations.update.mockReturnValue(request.promise);
    renderWithClient(<BoardStateEditorPage boardState={BOARD_STATE} />);
    act(() => addUnit());

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Pin rules 2.0" }));
    await act(async () => request.resolve(BOARD_STATE));

    expect(screen.getByText("guard: blocking")).toBeInTheDocument();
  });
});

describe("saved board editor after a create", () => {
  it("keeps the handed-over edits instead of loading the server document", () => {
    act(() => addUnit());
    useBoardEditorStore.getState().adopt({
      boardId: "board-1",
      title: "Renamed during the create",
      coreRulesVersion: "1.0",
      tournamentRulesVersion: null,
      metaDirty: true,
    });

    renderWithClient(<BoardStateEditorPage boardState={BOARD_STATE} />);

    expect(useBoardEditorStore.getState().document.steps[0]?.pieces).toHaveLength(1);
    expect(screen.getByText("Renamed during the create")).toBeInTheDocument();
    expect(screen.getByText("guard: blocking")).toBeInTheDocument();
    expect(useBoardEditorStore.getState().adoption).toBeNull();
  });

  it("loads the server document when the hand-over is for another board", () => {
    act(() => addUnit());
    useBoardEditorStore.getState().adopt({
      boardId: "board-9",
      title: "Other board",
      coreRulesVersion: "1.0",
      tournamentRulesVersion: null,
      metaDirty: false,
    });

    renderWithClient(<BoardStateEditorPage boardState={BOARD_STATE} />);

    expect(useBoardEditorStore.getState().document.steps[0]?.pieces).toHaveLength(0);
    expect(screen.getByText(BOARD_STATE.title)).toBeInTheDocument();
    expect(screen.getByText("guard: open")).toBeInTheDocument();
  });

  it("loads the server document when the board is opened again later", () => {
    act(() => addUnit());
    useBoardEditorStore.getState().adopt({
      boardId: "board-1",
      title: BOARD_STATE.title,
      coreRulesVersion: "1.0",
      tournamentRulesVersion: null,
      metaDirty: false,
    });
    renderWithClient(<BoardStateEditorPage boardState={BOARD_STATE} />).unmount();

    renderWithClient(<BoardStateEditorPage boardState={BOARD_STATE} />);

    expect(useBoardEditorStore.getState().document.steps[0]?.pieces).toHaveLength(0);
  });
});

describe("new board editor", () => {
  it("drops the hand-over when the reader leaves without saving", async () => {
    const request = deferred<{ id: string }>();
    mutations.create.mockReturnValue(request.promise);
    renderWithClient(<NewBoardStatePage />);
    await screen.findByRole("button", { name: "Save" });
    act(() => addUnit());

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    act(() => addUnit());
    await act(async () => request.resolve({ id: "board-2" }));
    act(() => mutations.onLeave?.());

    expect(useBoardEditorStore.getState().adoption).toBeNull();
  });

  it("neither hands over nor navigates when the page closed during the create", async () => {
    const request = deferred<{ id: string }>();
    mutations.create.mockReturnValue(request.promise);
    const view = renderWithClient(<NewBoardStatePage />);
    await screen.findByRole("button", { name: "Save" });
    act(() => addUnit());

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    view.unmount();
    await act(async () => request.resolve({ id: "board-2" }));

    expect(useBoardEditorStore.getState().adoption).toBeNull();
    expect(mutations.navigate).not.toHaveBeenCalled();
  });

  it("updates the created board on the next save instead of creating another", async () => {
    const request = deferred<{ id: string }>();
    mutations.create.mockReturnValue(request.promise);
    mutations.update.mockResolvedValue({ ...BOARD_STATE, id: "board-2" });
    renderWithClient(<NewBoardStatePage />);
    await screen.findByRole("button", { name: "Save" });
    act(() => addUnit());

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    act(() => addUnit());
    await act(async () => request.resolve({ id: "board-2" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));

    expect(mutations.create).toHaveBeenCalledTimes(1);
    expect(mutations.update).toHaveBeenCalledWith(expect.objectContaining({ id: "board-2" }));
    expect(screen.getByText("guard: open")).toBeInTheDocument();
  });

  it("hands the unsaved edits to the created board's page", async () => {
    const request = deferred<{ id: string }>();
    mutations.create.mockReturnValue(request.promise);
    renderWithClient(<NewBoardStatePage />);
    await screen.findByRole("button", { name: "Save" });
    act(() => addUnit());

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Pin rules 2.0" }));
    await act(async () => request.resolve({ id: "board-2" }));

    expect(useBoardEditorStore.getState().adoption).toEqual({
      boardId: "board-2",
      title: "Untitled board state",
      coreRulesVersion: "2.0",
      tournamentRulesVersion: null,
      metaDirty: true,
    });
    expect(mutations.navigate).toHaveBeenCalledWith({
      to: "/board-states/$boardStateId",
      params: { boardStateId: "board-2" },
    });
    expect(
      mutations.allowNavigation?.(
        { pathname: "/board-states/new" },
        { pathname: "/board-states/board-2" },
      ),
    ).toBe(true);
    expect(
      mutations.allowNavigation?.({ pathname: "/board-states/new" }, { pathname: "/cards" }),
    ).toBe(false);
  });

  it("keeps a board edit made during creation unsaved", async () => {
    const request = deferred<{ id: string }>();
    mutations.create.mockReturnValue(request.promise);
    renderWithClient(<NewBoardStatePage />);
    await screen.findByRole("button", { name: "Save" });
    act(() => addUnit());

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    act(() => addUnit());
    await act(async () => request.resolve({ id: "board-2" }));

    expect(screen.getByText("guard: blocking")).toBeInTheDocument();
  });

  it("keeps a rules pin changed during creation unsaved", async () => {
    const request = deferred<{ id: string }>();
    mutations.create.mockReturnValue(request.promise);
    renderWithClient(<NewBoardStatePage />);
    await screen.findByRole("button", { name: "Save" });
    act(() => addUnit());

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Pin rules 2.0" }));
    await act(async () => request.resolve({ id: "board-2" }));

    expect(screen.getByText("guard: blocking")).toBeInTheDocument();
  });

  it("marks the draft clean before opening the created board", async () => {
    mutations.create.mockResolvedValue({ id: "board-2" });
    renderWithClient(<NewBoardStatePage />);
    await screen.findByRole("button", { name: "Save" });
    act(() => addUnit());

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));

    expect(screen.getByText("guard: open")).toBeInTheDocument();
    expect(mutations.navigate).toHaveBeenCalledWith({
      to: "/board-states/$boardStateId",
      params: { boardStateId: "board-2" },
    });
  });
});
