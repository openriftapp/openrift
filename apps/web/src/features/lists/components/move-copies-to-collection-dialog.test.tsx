import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutateAsync = vi.fn();
const invalidateQueries = vi.fn();
const toastSuccess = vi.fn();
let copiesReady = true;

vi.mock("sonner", () => ({ toast: { success: (...args: unknown[]) => toastSuccess(...args) } }));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal()),
  useQueryClient: () => ({ invalidateQueries }),
}));

vi.mock("@/hooks/use-session", () => ({ useUserId: () => "user-1" }));

vi.mock("@/features/collections/hooks/use-collections", () => ({
  useCollections: () => ({
    data: [
      { id: "col-binder", name: "Binder", isInbox: false },
      { id: "col-bulk", name: "Bulk box", isInbox: false },
    ],
  }),
}));

vi.mock("@/features/collections/hooks/use-copies", () => ({
  useCopies: () => ({
    data: [
      { id: "c1", collectionId: "col-binder" },
      { id: "c2", collectionId: "col-binder" },
      { id: "c3", collectionId: "col-bulk" },
    ],
    isReady: copiesReady,
  }),
  useMoveCopies: () => ({ mutateAsync, isPending: false }),
}));

const { MoveCopiesToCollectionDialog } = await import("./move-copies-to-collection-dialog");

function renderDialog(copyIds: string[]) {
  const onOpenChange = vi.fn();
  const onMoved = vi.fn();
  render(
    <MoveCopiesToCollectionDialog
      listId="list-1"
      copyIds={copyIds}
      open
      onOpenChange={onOpenChange}
      onMoved={onMoved}
    />,
  );
  return { onOpenChange, onMoved };
}

describe("MoveCopiesToCollectionDialog", () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    mutateAsync.mockImplementation(async ({ copyIds }: { copyIds: string[] }) =>
      copyIds.map((copyId) => ({ copyId, fromCollectionId: "col-binder" })),
    );
    invalidateQueries.mockReset();
    toastSuccess.mockReset();
    copiesReady = true;
  });

  it("titles the dialog with the count and hints copies already in each collection", () => {
    renderDialog(["c1", "c2", "c3"]);

    expect(screen.getByText("Move 3 copies to collection")).toBeInTheDocument();
    expect(screen.getByText("2 already here")).toBeInTheDocument();
    expect(screen.getByText("1 already here")).toBeInTheDocument();
  });

  it("moves only the copies not yet in the picked collection and reports the rest", async () => {
    const { onOpenChange, onMoved } = renderDialog(["c1", "c2", "c3"]);

    fireEvent.click(screen.getByRole("option", { name: /Bulk box/u }));
    fireEvent.click(screen.getByRole("button", { name: "Move 2 copies" }));

    expect(mutateAsync).toHaveBeenCalledWith({ copyIds: ["c1", "c2"], toCollectionId: "col-bulk" });
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith('Moved 2 copies to "Bulk box"', {
        action: { label: "Undo", onClick: expect.any(Function) },
        description: "1 was already there.",
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onMoved).toHaveBeenCalled();
    expect(invalidateQueries).toHaveBeenCalledTimes(2);
  });

  it("omits the already-there note when every copy moves", async () => {
    renderDialog(["c1", "c2"]);

    fireEvent.click(screen.getByRole("option", { name: /Bulk box/u }));
    fireEvent.click(screen.getByRole("button", { name: "Move 2 copies" }));

    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        'Moved 2 copies to "Bulk box"',
        expect.objectContaining({ description: undefined }),
      ),
    );
  });

  it("moves the copies back and refreshes the list on undo", async () => {
    renderDialog(["c1", "c2"]);

    fireEvent.click(screen.getByRole("option", { name: /Bulk box/u }));
    fireEvent.click(screen.getByRole("button", { name: "Move 2 copies" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    invalidateQueries.mockReset();
    const [, options] = toastSuccess.mock.calls[0] as [string, { action: { onClick: () => void } }];
    options.action.onClick();

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenLastCalledWith({
        copyIds: ["c1", "c2"],
        toCollectionId: "col-binder",
      }),
    );
    await waitFor(() => expect(invalidateQueries).toHaveBeenCalledTimes(2));
  });

  it("blocks the confirm when every copy is already in the picked collection", () => {
    renderDialog(["c1", "c2"]);

    fireEvent.click(screen.getByRole("option", { name: /Binder/u }));

    expect(screen.getByRole("button", { name: "All already here" })).toBeDisabled();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("blocks the confirm until the copies have loaded", () => {
    copiesReady = false;
    renderDialog(["c1", "c3"]);

    fireEvent.click(screen.getByRole("option", { name: /Bulk box/u }));

    expect(screen.getByRole("button", { name: "Move 1 copy" })).toBeDisabled();
  });

  it("moves a single copy on pick and disables the collection it is already in", async () => {
    renderDialog(["c3"]);

    expect(screen.getByText("Move 1 copy to collection")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Bulk box/u })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    fireEvent.click(screen.getByRole("option", { name: /Binder/u }));

    expect(mutateAsync).toHaveBeenCalledWith({ copyIds: ["c3"], toCollectionId: "col-binder" });
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        'Moved 1 copy to "Binder"',
        expect.objectContaining({ description: undefined }),
      ),
    );
  });
});
