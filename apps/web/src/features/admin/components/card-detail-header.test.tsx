import type { AdminCardResponse } from "@openrift/shared/types/api/admin";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({
  rename: vi.fn(),
  deleteCard: vi.fn(),
  leftSlugs: [] as string[],
}));

vi.mock("@tanstack/react-router", () => ({
  Link: function Link() {
    return null;
  },
  createLink: () =>
    function BackLink() {
      return null;
    },
}));

vi.mock("@/features/admin/components/admin-page-top-bar", () => ({
  AdminPageTopBar: ({ actions }: { actions?: ReactNode }) => <div>{actions}</div>,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => null,
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/confirm-action-dialog", () => ({
  ConfirmActionDialog: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? (
      <button type="button" onClick={onConfirm}>
        Confirm delete
      </button>
    ) : null,
}));

vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  useRenameCard: () => ({ mutateAsync: captured.rename, isPending: false }),
  useDeleteCard: () => ({ mutateAsync: captured.deleteCard, isPending: false }),
  useLeaveCardPage: () => async (oldSlug: string, leave: () => Promise<void>) => {
    await leave();
    captured.leftSlugs.push(oldSlug);
  },
}));

import { CardDetailHeader } from "./card-detail-header";

const card = { id: "card-uuid", name: "Yasuo", errata: null } as unknown as AdminCardResponse;

function renderHeader(
  props: Partial<React.ComponentProps<typeof CardDetailHeader>> = {},
): ReturnType<typeof render> {
  const noop = async () => {};
  return render(
    <CardDetailHeader
      card={card}
      cardSlug="yasuo"
      expectedCardSlug="yasuo"
      hasUnchecked={false}
      prevNextCards={{ prev: "ahri", next: "zed" }}
      listSearch={{}}
      isCheckingAll={false}
      onCheckAllAndNext={noop}
      goToCard={noop}
      goToList={noop}
      isAdmin
      {...props}
    />,
  );
}

beforeEach(() => {
  captured.rename.mockReset();
  captured.deleteCard.mockReset();
  captured.leftSlugs = [];
});

describe("CardDetailHeader", () => {
  it("shows the run state on the check-all button", () => {
    const { getAllByRole } = renderHeader({ isCheckingAll: true });

    const busy = getAllByRole("button", { name: /Check all & next/u }).filter(
      (button) => button.getAttribute("aria-busy") === "true",
    );
    expect(busy.length).toBeGreaterThan(0);
  });

  it("offers a regenerate when the stored slug no longer matches and opens the new slug once it lands", async () => {
    captured.rename.mockResolvedValue(undefined);
    const goToCard = vi.fn();
    const { getByText } = renderHeader({ cardSlug: "yasu", expectedCardSlug: "yasuo", goToCard });

    getByText("Regenerate ID (yasuo)").click();
    expect(captured.rename).toHaveBeenCalledWith({ cardId: "card-uuid", newId: "yasuo" });
    await vi.waitFor(() => expect(goToCard).toHaveBeenCalledWith("yasuo"));
  });

  it("forgets the old address once the renamed card's page opens", async () => {
    captured.rename.mockResolvedValue(undefined);
    const { getByText } = renderHeader({ cardSlug: "yasu", expectedCardSlug: "yasuo" });

    getByText("Regenerate ID (yasuo)").click();

    await vi.waitFor(() => expect(captured.leftSlugs).toEqual(["yasu"]));
  });

  it("forgets the deleted card's address once the list opens", async () => {
    captured.deleteCard.mockResolvedValue(undefined);
    const goToList = vi.fn(async () => {});
    const { getByText } = renderHeader({ goToList });

    getByText("Delete card").click();
    await vi.waitFor(() => getByText("Confirm delete").click());

    await vi.waitFor(() => expect(captured.leftSlugs).toEqual(["yasuo"]));
    expect(goToList).toHaveBeenCalledOnce();
  });

  it("stays on the card when the regenerate fails", async () => {
    captured.rename.mockRejectedValue(new Error("Network down"));
    const goToCard = vi.fn();
    const { getByText } = renderHeader({ cardSlug: "yasu", expectedCardSlug: "yasuo", goToCard });

    getByText("Regenerate ID (yasuo)").click();
    await vi.waitFor(() => expect(captured.rename).toHaveBeenCalledOnce());
    await Promise.resolve();
    expect(goToCard).not.toHaveBeenCalled();
  });

  it("stays quiet when the slug is current", () => {
    const { queryByText } = renderHeader();

    expect(queryByText("Regenerate ID (yasuo)")).toBeNull();
  });

  it("shows the drift to non-admins but hides the regenerate action", () => {
    const { getByText, queryByText } = renderHeader({
      cardSlug: "yasu",
      expectedCardSlug: "yasuo",
      isAdmin: false,
    });

    expect(getByText("ID → yasuo")).toBeTruthy();
    expect(queryByText("Regenerate ID (yasuo)")).toBeNull();
  });

  it("hides the admin actions from non-admins", () => {
    const { queryByText } = renderHeader({ isAdmin: false });

    expect(queryByText("Check all & next")).toBeNull();
  });

  it("navigates to the neighbouring cards", () => {
    const goToCard = vi.fn();
    const { getByLabelText } = renderHeader({ goToCard });

    getByLabelText("Previous card").click();
    getByLabelText("Next card").click();
    expect(goToCard).toHaveBeenNthCalledWith(1, "ahri");
    expect(goToCard).toHaveBeenNthCalledWith(2, "zed");
  });

  it("disables the arrows at the ends of the run", () => {
    const { getByLabelText } = renderHeader({ prevNextCards: { prev: null, next: null } });

    expect((getByLabelText("Previous card") as HTMLButtonElement).disabled).toBe(true);
    expect((getByLabelText("Next card") as HTMLButtonElement).disabled).toBe(true);
  });
});
