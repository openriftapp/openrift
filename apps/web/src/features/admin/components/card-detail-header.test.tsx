import type { AdminCardResponse } from "@openrift/shared/types/api/admin";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({
  rename: vi.fn(),
  deleteCard: vi.fn(),
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

vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  useRenameCard: () => ({ mutate: captured.rename, isPending: false }),
  useDeleteCard: () => ({ mutate: captured.deleteCard, isPending: false }),
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { CardDetailHeader } from "./card-detail-header";

const card = { id: "card-uuid", name: "Yasuo", errata: null } as unknown as AdminCardResponse;

function renderHeader(
  props: Partial<React.ComponentProps<typeof CardDetailHeader>> = {},
): ReturnType<typeof render> {
  const noop = () => {};
  return render(
    <CardDetailHeader
      card={card}
      cardId="yasuo"
      expectedCardId="yasuo"
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
});

describe("CardDetailHeader", () => {
  it("shows the run state on the check-all button", () => {
    const { getByText } = renderHeader({ isCheckingAll: true });

    expect(getByText("Checking…")).toBeTruthy();
  });

  it("offers a regenerate when the stored slug no longer matches", () => {
    const { getByText } = renderHeader({ cardId: "yasu", expectedCardId: "yasuo" });

    getByText("Regenerate ID (yasuo)").click();
    expect(captured.rename).toHaveBeenCalledWith(
      { cardId: "card-uuid", newId: "yasuo" },
      expect.anything(),
    );
  });

  it("stays quiet when the slug is current", () => {
    const { queryByText } = renderHeader();

    expect(queryByText("Regenerate ID (yasuo)")).toBeNull();
  });

  it("shows the drift to non-admins but hides the regenerate action", () => {
    const { getByText, queryByText } = renderHeader({
      cardId: "yasu",
      expectedCardId: "yasuo",
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
