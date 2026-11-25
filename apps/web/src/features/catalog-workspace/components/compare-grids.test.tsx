import type {
  AdminCardDetailResponse,
  AdminPrintingResponse,
  CandidatePrintingResponse,
} from "@openrift/shared/types/api/admin";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetWorkspaceWriteQueue } from "@/features/catalog-workspace/lib/workspace-write-queue";

interface ColumnActionProps {
  targets: { id: string; label: string }[];
  onAssign: (input: { candidatePrintingIds: string[]; printingId: string | null }) => void;
  onDelete: (id: string) => void;
}

const state = vi.hoisted(() => ({
  columnActions: [] as (ReactElement<ColumnActionProps> | undefined)[],
  link: vi.fn(async (..._args: unknown[]) => {}),
  remove: vi.fn(async (..._args: unknown[]) => {}),
}));

vi.mock("@/features/admin/components/candidate-spreadsheet", () => ({
  CandidateSpreadsheet: ({
    columnActions,
  }: {
    columnActions?: ReactElement<ColumnActionProps>;
  }) => {
    state.columnActions.push(columnActions);
    return null;
  },
}));

vi.mock("@/features/admin/components/card-detail-shared", () => ({
  buildPrintingNormalizer: () => (row: unknown) => row,
  buildSourceLabels: () => ({ labels: {}, names: {}, submitters: {} }),
  useCardDetailData: () => ({ printingSourceFields: [] }),
}));

vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => {
  const idle = () => ({ mutateAsync: vi.fn(), isPending: false });
  return {
    acceptCardFieldFn: vi.fn(),
    useAcceptPrintingField: idle,
    useCheckCandidateCards: idle,
    useCheckCandidatePrinting: idle,
    useCopyCandidatePrinting: idle,
    useDeleteCandidatePrinting: () => ({ mutateAsync: state.remove, isPending: false }),
    useLinkCandidatePrintings: () => ({ mutateAsync: state.link, isPending: false }),
    useUncheckCandidatePrinting: idle,
  };
});

vi.mock("@/features/admin/hooks/use-ignored-candidates", () => ({
  useIgnoreCandidatePrinting: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/features/catalog-workspace/hooks/use-suggestion-writes", () => ({
  usePrintingFieldAccept: () => ({ accept: vi.fn(), pending: false }),
}));

const face = {
  id: "p-1",
  faceId: "f-1",
  side: 1,
  setSlug: "ogn",
  publicCode: "OGN-001",
  expectedPrintingId: "OGN-001",
  otherFace: null,
} as unknown as AdminPrintingResponse;

const otherPrinting = {
  ...face,
  id: "p-2",
  faceId: "f-2",
  expectedPrintingId: "OGN-001-foil",
} as unknown as AdminPrintingResponse;

const candidate = {
  id: "cp-1",
  candidateCardId: "cc-1",
  printingId: "p-1",
  faceId: "f-1",
  provider: "gallery",
} as unknown as CandidatePrintingResponse;

const detail = {
  displayName: "Jinx",
  card: { types: ["unit"] },
  printings: [face, otherPrinting],
  printingImages: [],
  sources: [],
  setTotals: {},
} as unknown as AdminCardDetailResponse;

vi.mock("@/features/catalog-workspace/lib/face-suggestion-rows", () => ({
  faceCompareCandidates: () => [candidate],
}));

vi.mock("@/features/catalog-workspace/lib/printing-suggestion-rows", () => ({
  printingCompareGroups: () => [{ detail, face, candidates: [candidate] }],
}));

const { FaceCompareGrid, PrintingCompareGrid } = await import("./compare-grids");

const queryClient = new QueryClient();

function renderFace(isAdmin: boolean) {
  render(
    <QueryClientProvider client={queryClient}>
      <FaceCompareGrid
        cardSlug="jinx"
        faceId="f-1"
        detail={detail}
        providerSettings={[]}
        hiddenProviders={new Set()}
        costKeywords={[]}
        isAdmin={isAdmin}
      />
    </QueryClientProvider>,
  );
}

function renderPrinting(isAdmin: boolean) {
  render(
    <QueryClientProvider client={queryClient}>
      <PrintingCompareGrid
        printingId="p-1"
        cardSlugs={["jinx"]}
        details={[detail]}
        providerSettings={[]}
        hiddenProviders={new Set()}
        costKeywords={[]}
        isAdmin={isAdmin}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.columnActions = [];
  state.link.mockClear();
  state.remove.mockClear();
});

afterEach(() => {
  resetWorkspaceWriteQueue();
});

describe.each([
  ["face", renderFace],
  ["printing", renderPrinting],
])("the %s compare grid's source-row actions", (_level, renderGrid) => {
  it("offers every printing of the card as a move target", () => {
    renderGrid(true);

    const actions = state.columnActions.at(-1);
    expect(actions?.props.targets.map((target) => target.id)).toEqual(["p-1", "p-2"]);
  });

  it("queues a move and a delete as workspace writes", async () => {
    renderGrid(true);
    const actions = state.columnActions.at(-1);

    actions?.props.onAssign({ candidatePrintingIds: ["cp-1"], printingId: "p-2" });
    actions?.props.onDelete("cp-1");

    await vi.waitFor(() => expect(state.remove).toHaveBeenCalledOnce());
    expect(state.link).toHaveBeenCalledWith(
      { candidatePrintingIds: ["cp-1"], printingId: "p-2" },
      { signal: expect.any(AbortSignal) },
    );
    expect(state.remove).toHaveBeenCalledWith("cp-1", { signal: expect.any(AbortSignal) });
  });

  it("hides them from non-admins", () => {
    renderGrid(false);

    expect(state.columnActions.at(-1)).toBeUndefined();
  });
});
