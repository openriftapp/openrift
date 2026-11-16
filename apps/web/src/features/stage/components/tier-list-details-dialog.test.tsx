import type { TierListResponse } from "@openrift/shared/types/api/tier-list";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/stage/hooks/use-tier-lists", () => ({
  useUpdateTierList: () => ({ mutate: vi.fn(), isPending: false }),
}));

const { TierListDetailsDialog } = await import("./tier-list-details-dialog");

const TIER_LIST = {
  id: "list-1",
  title: "Best legends",
  description: "Patch notes",
} as TierListResponse;

function dialog(open: boolean) {
  return <TierListDetailsDialog tierList={TIER_LIST} open={open} onOpenChange={vi.fn()} />;
}

describe("TierListDetailsDialog", () => {
  it("starts from the saved title again when the parent reopens it", async () => {
    const { rerender } = render(dialog(true));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Abandoned" } });

    rerender(dialog(false));
    rerender(dialog(true));

    expect(await screen.findByLabelText("Title")).toHaveValue("Best legends");
  });
});
