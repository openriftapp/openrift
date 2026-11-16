import type { Printing } from "@openrift/shared/types/catalog";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { m } from "@/paraglide/messages.js";
import { stubPrinting } from "@/test/factories";

const createMutate = vi.fn(
  (_payload: unknown, opts?: { onSuccess?: (list: { id: string; name: string }) => unknown }) => {
    void opts?.onSuccess?.({ id: "new-list", name: "Wants" });
  },
);
const bulkAddMutate = vi.fn();
const bulkAddMutateAsync = vi.fn().mockResolvedValue({ added: 1, updated: 0, skipped: 0 });

vi.mock("@/features/lists/hooks/use-lists", () => ({
  useLists: () => ({ data: [] }),
  useCreateList: () => ({ mutate: createMutate, isPending: false }),
  useBulkAddListEntries: () => ({
    mutate: bulkAddMutate,
    mutateAsync: bulkAddMutateAsync,
    isPending: false,
  }),
}));

const toastSuccess = vi.fn();
const toastWarning = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    warning: (...args: unknown[]) => toastWarning(...args),
    info: vi.fn(),
  },
}));

vi.mock("@/features/groups/hooks/use-friend-groups", () => ({
  useFriendGroupsList: () => ({ data: { items: [] } }),
}));

vi.mock("@/features/groups/hooks/use-friend-group-sharing", () => ({
  useShareListWithFriendGroup: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUnshareListFromFriendGroup: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/stores/display-store", () => ({
  useDisplayStore: (selector: (state: { defaultCurrency: string }) => unknown) =>
    selector({ defaultCurrency: "EUR" }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: () => null,
}));

vi.mock("@/features/groups/components/trade-preference-editor", () => ({
  TradePreferenceEditor: () => null,
}));

const { WishlistPickerHost } = await import("./wishlist-picker-host");

const printing = stubPrinting({ cardId: "card-1", printingId: "printing-1" });

function Harness() {
  const [target, setTarget] = useState<Printing | null>(null);
  return (
    <>
      <button type="button" onClick={() => setTarget(printing)}>
        Open picker
      </button>
      <WishlistPickerHost target={target} onClose={() => setTarget(null)} />
    </>
  );
}

beforeEach(() => {
  createMutate.mockClear();
  bulkAddMutate.mockClear();
  bulkAddMutateAsync.mockClear();
  toastSuccess.mockClear();
  toastWarning.mockClear();
});

async function openCreateDialog() {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole("button", { name: "Open picker" }));
  await user.click(screen.getByRole("button", { name: "New wishlist" }));
  return user;
}

describe("WishlistPickerHost", () => {
  it("opens the create dialog for the same card from the picker", async () => {
    await openCreateDialog();

    expect(await screen.findByRole("dialog")).toHaveTextContent(/New wishlist for/u);
    expect(screen.queryByText("Add to wishlist")).not.toBeInTheDocument();
  });

  it("adds the card to the wishlist it creates, then closes the flow", async () => {
    const user = await openCreateDialog();

    await user.type(await screen.findByRole("textbox"), "Wants");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(bulkAddMutateAsync).toHaveBeenCalledWith({
        listId: "new-list",
        entries: [{ cardId: "card-1" }],
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(toastSuccess).toHaveBeenCalledWith(m.lists_add_added_cards({ count: 1, list: "Wants" }));
  });

  it("closes the create form when the card can't be added to the new wishlist", async () => {
    bulkAddMutateAsync.mockRejectedValueOnce(new Error("offline"));
    const user = await openCreateDialog();

    await user.type(await screen.findByRole("textbox"), "Wants");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(createMutate).toHaveBeenCalledTimes(1);
    expect(toastWarning).toHaveBeenCalledWith(
      m.lists_create_entries_failed({ count: 1, list: "Wants" }),
    );
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("closes the whole flow when the create dialog is cancelled", async () => {
    const user = await openCreateDialog();

    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(createMutate).not.toHaveBeenCalled();
  });

  it("starts at the picker again after a cancelled create", async () => {
    const user = await openCreateDialog();
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Open picker" }));

    expect(await screen.findByText("Add to wishlist")).toBeInTheDocument();
  });
});
