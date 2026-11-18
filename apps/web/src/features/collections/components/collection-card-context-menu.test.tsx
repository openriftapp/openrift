// @vitest-environment jsdom
import type * as ReactRouter from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CardRowActionsStore } from "@/features/cards/stores/card-row-actions-store";
import {
  CardRowActionsStoreContext,
  createCardRowActionsStore,
} from "@/features/cards/stores/card-row-actions-store";
import { stubPrinting } from "@/test/factories";

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof ReactRouter>("@tanstack/react-router");
  return {
    ...actual,
    Link: ({
      children,
      params,
      search: _search,
      ...rest
    }: {
      children?: ReactNode;
      params: { cardSlug: string };
      search?: unknown;
    }) => (
      <a {...rest} href={`/cards/${params.cardSlug}`}>
        {children}
      </a>
    ),
    useRouter: () => ({ buildLocation: () => ({ href: "/cards/falling-star" }) }),
  };
});

const { CollectionCardContextMenu } = await import("./collection-card-context-menu");

const printing = stubPrinting({ printingId: "printing-1", card: { slug: "falling-star" } });
let rowActions: CardRowActionsStore;
function resetHandlers() {
  rowActions = createCardRowActionsStore();
}

async function openMenu() {
  const user = userEvent.setup();
  render(
    <CardRowActionsStoreContext value={rowActions}>
      <CollectionCardContextMenu itemId="printing-1" printing={printing} canLend>
        <span>Falling Star tile</span>
      </CollectionCardContextMenu>
    </CardRowActionsStoreContext>,
  );
  await user.pointer({ keys: "[MouseRight]", target: screen.getByText("Falling Star tile") });
  return user;
}

describe("CollectionCardContextMenu", () => {
  beforeEach(resetHandlers);
  afterEach(resetHandlers);

  it("keeps the copy actions", async () => {
    await openMenu();
    expect(await screen.findByRole("menuitem", { name: "Dispose" })).toBeInTheDocument();
  });

  it("adds the shown printing to a wishlist", async () => {
    const onAddToWishlist = vi.fn();
    rowActions.getState().setHandlers({ onAddToWishlist });
    const user = await openMenu();
    await user.click(await screen.findByRole("menuitem", { name: "Add to wishlist…" }));
    expect(onAddToWishlist).toHaveBeenCalledWith(printing);
  });

  it("links to the card page", async () => {
    await openMenu();
    const item = await screen.findByRole("menuitem", { name: "Open card page" });
    expect(item).toHaveAttribute("href", "/cards/falling-star");
    expect(screen.getByRole("menuitem", { name: "Copy link" })).toBeInTheDocument();
  });
});
