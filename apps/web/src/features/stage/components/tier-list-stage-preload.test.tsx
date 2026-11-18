import type {
  PublicTierListDetailResponse,
  TierListResponse,
} from "@openrift/shared/types/api/tier-list";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const usePreloadStageShowCode = vi.hoisted(() => vi.fn());
vi.mock("@/features/stage/hooks/use-preload-stage-show", () => ({ usePreloadStageShowCode }));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: ReactNode }) => <a href="/stage/show">{children}</a>,
}));
vi.mock("@/components/layout/builder-workbench", () => ({ BuilderWorkbench: () => null }));
vi.mock("@/components/unsaved-changes-guard", () => ({ UnsavedChangesGuard: () => null }));
vi.mock("@/features/stage/components/tier-list-dnd-context", () => ({
  TierListDndContext: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/features/stage/components/tier-list-details-dialog", () => ({
  TierListDetailsDialog: () => null,
}));
vi.mock("@/features/stage/components/tier-list-share-dialog", () => ({
  TierListShareDialog: () => null,
}));
vi.mock("@/components/confirm-action-dialog", () => ({ ConfirmActionDialog: () => null }));
vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({ cardsById: {}, printingsByCardId: new Map() }),
}));
vi.mock("@/features/stage/hooks/use-tier-lists", () => ({
  useUpdateTierList: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteTierList: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/features/cards/components/selection-detail-overlays", () => ({
  SelectionDetailOverlays: () => null,
}));

const { TierListBuilderPage } = await import("./tier-list-builder-page");
const { TierListShareView } = await import("./tier-list-share-view");

const tierList = {
  id: "tier-1",
  title: "Summoner Skirmish picks",
  description: null,
  tiers: [],
} as unknown as TierListResponse;

beforeEach(() => {
  usePreloadStageShowCode.mockClear();
});

describe("tier list pages preload the stage show", () => {
  it("loads the show's code from the builder", () => {
    render(<TierListBuilderPage tierList={tierList} />);

    expect(usePreloadStageShowCode).toHaveBeenCalledOnce();
  });

  it("loads the show's code from a shared tier list", () => {
    const data = {
      tierList: { ...tierList, tiers: [] },
      owner: { displayName: "Ana" },
    } as unknown as PublicTierListDetailResponse;
    render(<TierListShareView data={data} token="aB3dE5gH7jK9" />);

    expect(usePreloadStageShowCode).toHaveBeenCalledOnce();
  });
});
