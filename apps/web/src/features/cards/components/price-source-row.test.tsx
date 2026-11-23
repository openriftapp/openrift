import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDisplayStore } from "@/stores/display-store";
import { createStoreResetter } from "@/test/store-helpers";

const session = vi.hoisted(() => ({ userId: null as string | null }));

vi.mock("@/hooks/use-session", () => ({ useUserId: () => session.userId }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, hash }: { children?: ReactNode; to: string; hash?: string }) => (
    <a href={`${to}#${hash}`}>{children}</a>
  ),
}));

const { PriceSourceRow } = await import("./price-source-row");

const resetDisplayStore = createStoreResetter(useDisplayStore);

beforeEach(() => {
  resetDisplayStore();
  session.userId = null;
});

afterEach(() => {
  resetDisplayStore();
});

describe("PriceSourceRow", () => {
  it("lets a signed-out visitor pick the marketplace prices come from", async () => {
    useDisplayStore.getState().setMarketplaceOrder(["cardtrader", "tcgplayer", "cardmarket"]);
    const user = userEvent.setup();
    render(<PriceSourceRow />);

    await user.click(screen.getByRole("combobox", { name: "Prices" }));
    await user.click(await screen.findByRole("option", { name: /TCGplayer/u }));

    expect(useDisplayStore.getState().marketplaceOrder).toEqual([
      "tcgplayer",
      "cardtrader",
      "cardmarket",
    ]);
  });

  it("names the account's marketplace and links to settings for a signed-in viewer", () => {
    session.userId = "user-1";
    useDisplayStore.getState().setMarketplaceOrder(["cardmarket", "tcgplayer"]);
    render(<PriceSourceRow />);

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("Cardmarket")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Change" }).getAttribute("href")).toBe(
      "/profile#marketplaces",
    );
  });
});
