import type { ListResponse } from "@openrift/shared/types/api/list";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/lists/components/move-entry-dialog", () => ({
  ConnectedMoveEntryDialogBody: () => null,
}));

const { MoveToListDialog } = await import("./move-to-list-dialog");

function stubList(overrides: Partial<ListResponse>): ListResponse {
  return { id: "l1", name: "Wants", kind: "card", intent: "wish", ...overrides } as ListResponse;
}

const LISTS = [
  stubList({ id: "w1", name: "Wants", kind: "card", intent: "wish" }),
  stubList({ id: "w2", name: "Exact wants", kind: "printing", intent: "wish" }),
  stubList({ id: "o1", name: "Binder plan", kind: "card", intent: "organize" }),
];

function renderDialog(onConfirm = vi.fn()) {
  render(
    <MoveToListDialog
      open
      onOpenChange={() => {}}
      mode="move"
      lists={LISTS}
      source={{ kind: "card", intent: "wish" }}
      subject={null}
      onConfirm={onConfirm}
      isPending={false}
    />,
  );
  return onConfirm;
}

describe("MoveToListDialog", () => {
  it("groups the target lists by intent", () => {
    renderDialog();

    expect(screen.getByText("Wishlists")).toBeInTheDocument();
    expect(screen.getByText("Organize lists")).toBeInTheDocument();
    expect(screen.queryByText("Tradelists")).not.toBeInTheDocument();
  });

  it("moves to the picked list once confirmed", () => {
    const onConfirm = renderDialog();
    const move = screen.getByRole("button", { name: "Move" });
    expect(move).toBeDisabled();

    fireEvent.click(screen.getByRole("option", { name: /^Wants/u }));
    fireEvent.click(move);

    expect(onConfirm).toHaveBeenCalledWith(LISTS[0], null);
  });

  it("blocks a wider list for a multi-entry move and says why", () => {
    renderDialog();

    const wider = screen.getByRole("option", { name: /Exact wants/u });
    expect(wider).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(wider);

    expect(screen.getByRole("button", { name: "Move" })).toBeDisabled();
    expect(
      screen.getByText("Lists that track printings or copies take one card at a time."),
    ).toBeInTheDocument();
  });
});
