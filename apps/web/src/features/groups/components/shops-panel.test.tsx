import type { FriendGroupShopSearchResult } from "@openrift/shared/types/api/friend-group";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  results: [] as unknown[],
  isPending: false,
  link: vi.fn(),
}));

vi.mock("@/features/groups/hooks/use-friend-group-shops", () => ({
  SHOP_SEARCH_MIN_LENGTH: 2,
  useFriendGroupShops: () => ({ data: { items: [], limit: 5 } }),
  useFriendGroupShopSearch: (_slug: string, term: string) => ({
    data: term.trim().length >= 2 ? { items: state.results } : undefined,
    isPending: term.trim().length < 2 || state.isPending,
  }),
  useLinkFriendGroupShop: () => ({ mutate: state.link, isPending: false }),
  useUnlinkFriendGroupShop: () => ({ mutate: vi.fn(), isPending: false }),
}));

const { ShopsPanel } = await import("./shops-panel");

function shop(overrides: Partial<FriendGroupShopSearchResult> = {}): FriendGroupShopSearchResult {
  return {
    shopKey: "s1",
    name: "Piltover Games",
    source: "uvsgames",
    location: "Piltover",
    upcomingCount: 2,
    linked: false,
    ...overrides,
  } as FriendGroupShopSearchResult;
}

beforeEach(() => {
  state.results = [];
  state.isPending = false;
  state.link.mockReset();
});

async function openSearch() {
  const user = userEvent.setup();
  render(<ShopsPanel slug="crew" />);
  await user.click(screen.getByRole("combobox", { name: /Add shop/u }));
  return { user, input: await screen.findByPlaceholderText("Search by shop or town") };
}

describe("ShopsPanel shop search", () => {
  it("asks for a shop or town name before searching", async () => {
    await openSearch();

    expect(await screen.findByText("Type a shop or town name")).toBeInTheDocument();
  });

  it("links the shop picked with the arrow keys", async () => {
    state.results = [shop()];
    const { user, input } = await openSearch();

    await user.type(input, "pilt");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(state.link).toHaveBeenCalledExactlyOnceWith({ slug: "crew", shopKey: "s1" });
  });

  it("disables shops that are already linked", async () => {
    state.results = [shop({ linked: true })];
    const { user, input } = await openSearch();

    await user.type(input, "pilt");

    expect(await screen.findByRole("option", { name: /Piltover Games/u })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("says so when the search finds nothing", async () => {
    const { user, input } = await openSearch();

    await user.type(input, "zaun");

    expect(await screen.findByText("No shop with upcoming Riftbound events")).toBeInTheDocument();
  });

  it("shows the plus icon on the add button", () => {
    render(<ShopsPanel slug="crew" />);
    const trigger = screen.getByRole("combobox", { name: /Add shop/u });
    expect(trigger.querySelector("svg.lucide-plus")).not.toBeNull();
  });

  it("announces the running search", async () => {
    state.isPending = true;
    const { user, input } = await openSearch();

    await user.type(input, "pilt");

    expect(screen.getByText("Searching")).toHaveClass("sr-only");
  });
});
