import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { useLinkCard } from "@/features/admin/hooks/use-admin-card-mutations";
import type { AdminSearchableCard } from "@/features/cards/hooks/use-card-search";

vi.mock("@/features/cards/hooks/use-card-search", () => ({
  useAdminCardSearch: () => [],
}));

vi.mock("@/features/cards/components/card-search-dropdown", () => ({
  CardSearchDropdown: ({ onSelect }: { onSelect: (id: string) => void }) => (
    <button type="button" onClick={() => onSelect("card-uuid")}>
      Pick Jinx
    </button>
  ),
}));

const { AssignButton } = await import("./assign-button");

const mutateAsync = vi.fn();
const linkCard = { mutateAsync, isPending: false } as unknown as ReturnType<typeof useLinkCard>;
const allCards = [{ id: "card-uuid", slug: "jinx-loose-cannon" }] as AdminSearchableCard[];

beforeEach(() => {
  mutateAsync.mockReset().mockResolvedValue(undefined);
});

async function pick() {
  const user = userEvent.setup();
  render(<AssignButton normalizedName="jinx" allCards={allCards} linkCard={linkCard} />);
  await user.click(screen.getByRole("button", { name: "Assign to another card" }));
  await user.click(screen.getByRole("button", { name: "Pick Jinx" }));
}

describe("AssignButton", () => {
  it("links the draft to the picked card by id and slug, then closes", async () => {
    await pick();

    expect(mutateAsync).toHaveBeenCalledWith({
      name: "jinx",
      cardId: "card-uuid",
      cardSlug: "jinx-loose-cannon",
    });
    await vi.waitFor(() =>
      expect(screen.queryByRole("button", { name: "Pick Jinx" })).not.toBeInTheDocument(),
    );
  });

  it("stays open when the link fails", async () => {
    mutateAsync.mockRejectedValue(new Error("refused"));
    await pick();

    await vi.waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    await Promise.resolve();
    expect(screen.getByRole("button", { name: "Pick Jinx" })).toBeInTheDocument();
  });
});
