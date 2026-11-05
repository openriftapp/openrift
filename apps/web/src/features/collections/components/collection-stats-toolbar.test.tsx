import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const smUp = vi.hoisted(() => ({ value: true }));
vi.mock("@/hooks/use-sm-up", () => ({ useSmUp: () => smUp.value }));
vi.mock("@/features/collections/hooks/use-collections", () => ({
  useCollections: () => ({
    data: [
      { id: "col-1", name: "Red Deck Box" },
      { id: "col-2", name: "Binder 1" },
    ],
  }),
}));

const { CollectionStatsToolbar } = await import("./collection-stats-toolbar");

function renderToolbar(overrides: Partial<Parameters<typeof CollectionStatsToolbar>[0]> = {}) {
  const props = {
    collectionScope: "all",
    onCollectionScopeChange: vi.fn(),
    groupBy: "set" as const,
    onGroupByChange: vi.fn(),
    countMode: "cards" as const,
    onCountModeChange: vi.fn(),
    activeCount: 0,
    filters: <span>Card filters</span>,
    ...overrides,
  };
  render(<CollectionStatsToolbar {...props} />);
  return props;
}

describe("CollectionStatsToolbar", () => {
  afterEach(() => {
    smUp.value = true;
  });

  it("renders the filters inline from sm up", () => {
    renderToolbar({ collectionScope: "col-1", activeCount: 2 });

    expect(screen.getByText("Card filters")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Collection scope" })).toHaveTextContent(
      "Red Deck Box",
    );
    expect(screen.queryByRole("button", { name: "Filters" })).toBeNull();
  });

  it("hides the filters behind an icon trigger on phones", () => {
    smUp.value = false;
    renderToolbar({ activeCount: 3 });

    expect(screen.getByRole("button", { name: "Filters" })).toHaveTextContent("3");
    expect(screen.queryByText("Card filters")).toBeNull();
  });

  it("shows no count badge on phones without active filters", () => {
    smUp.value = false;
    renderToolbar();

    expect(screen.getByRole("button", { name: "Filters" })).not.toHaveTextContent(/\d/u);
  });

  it("names the picked collection next to the phone trigger", async () => {
    smUp.value = false;
    const user = userEvent.setup();
    const props = renderToolbar({ collectionScope: "col-2", activeCount: 1 });

    expect(screen.getByText("Binder 1")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Clear Binder 1 filter" }));

    expect(props.onCollectionScopeChange).toHaveBeenCalledWith("all");
  });

  it("shows no collection chip on phones when every collection is in scope", () => {
    smUp.value = false;
    renderToolbar();

    expect(screen.queryByText("Red Deck Box")).toBeNull();
    expect(screen.queryByText("Binder 1")).toBeNull();
  });

  it("opens the drawer with the filters on phones", async () => {
    smUp.value = false;
    const user = userEvent.setup();
    renderToolbar();

    await user.click(screen.getByRole("button", { name: "Filters" }));

    expect(await screen.findByText("Card filters")).toBeVisible();
  });
});
