import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({ move: vi.fn(), navigate: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => captured.navigate,
}));
vi.mock("@/features/admin/hooks/use-catalog-review", () => ({
  useMoveSubmission: () => ({ mutateAsync: captured.move, isPending: false }),
}));
vi.mock("@/features/admin/hooks/use-admin-card-queries", () => ({
  useAllCards: () => ({ data: [] }),
}));
vi.mock("@/features/cards/hooks/use-card-search", () => ({
  useAdminCardSearch: () => [{ id: "card-9", label: "Brush", sublabel: "brush", detail: "token" }],
}));
vi.mock("@/features/cards/components/card-search-dropdown", () => ({
  CardSearchDropdown: ({ onSelect }: { onSelect: (id: string) => void }) => (
    <button type="button" onClick={() => onSelect("card-9")}>
      Pick Brush
    </button>
  ),
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { MoveSubmissionDialog } from "./move-submission-dialog";

describe("MoveSubmissionDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.move.mockResolvedValue({ cardSlug: "brush" });
  });

  it("keeps Move disabled until a card is picked", async () => {
    render(
      <MoveSubmissionDialog
        candidateCardId="cand-1"
        submitterName="Renata"
        onOpenChange={vi.fn()}
      />,
    );
    expect(await screen.findByRole("button", { name: "Move" })).toBeDisabled();
  });

  it("moves to the picked card and opens it", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <MoveSubmissionDialog
        candidateCardId="cand-1"
        submitterName="Renata"
        onOpenChange={onOpenChange}
      />,
    );
    await user.click(await screen.findByRole("button", { name: "Pick Brush" }));
    await user.click(screen.getByRole("button", { name: "Move" }));

    expect(captured.move).toHaveBeenCalledWith({ candidateCardId: "cand-1", cardId: "card-9" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(captured.navigate).toHaveBeenCalledWith({
      to: "/admin/cards/$cardSlug",
      params: { cardSlug: "brush" },
    });
  });
});
