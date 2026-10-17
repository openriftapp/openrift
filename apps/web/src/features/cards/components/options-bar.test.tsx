import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFilterDrawerStore } from "@/features/cards/stores/filter-drawer-store";
import { useDisplayStore } from "@/stores/display-store";
import { useSelectionStore } from "@/stores/selection-store";
import { stubPrinting } from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

vi.mock("@/hooks/use-is-mobile", () => ({
  useIsMobile: () => false,
}));

const { DetailPaneToggle, MobileOptionsDrawer } = await import("./options-bar");

const resetSelectionStore = createStoreResetter(useSelectionStore);
const resetDisplayStore = createStoreResetter(useDisplayStore);
const resetFilterDrawerStore = createStoreResetter(useFilterDrawerStore);

beforeEach(() => {
  resetSelectionStore();
  resetDisplayStore();
  resetFilterDrawerStore();
});

afterEach(() => {
  resetSelectionStore();
  resetDisplayStore();
  resetFilterDrawerStore();
});

describe("DetailPaneToggle", () => {
  it("docks the pane without touching the selection", async () => {
    const user = userEvent.setup();
    render(<DetailPaneToggle />);

    await user.click(screen.getByRole("button", { name: "Show the card detail panel" }));

    expect(useDisplayStore.getState().paneDocked).toBe(true);
    expect(useSelectionStore.getState().detailOpen).toBe(false);
  });

  it("clears the selection when undocking so the modal does not take over", async () => {
    const user = userEvent.setup();
    useDisplayStore.setState({ paneDocked: true });
    useSelectionStore.setState({
      selectedCard: stubPrinting(),
      selectedIndex: 0,
      detailOpen: true,
    });
    render(<DetailPaneToggle />);

    await user.click(screen.getByRole("button", { name: "Hide the card detail panel" }));

    expect(useDisplayStore.getState().paneDocked).toBe(false);
    expect(useSelectionStore.getState().detailOpen).toBe(false);
    expect(useSelectionStore.getState().selectedCard).toBeNull();
  });

  it("leaves an already-empty selection alone when undocking", async () => {
    const user = userEvent.setup();
    useDisplayStore.setState({ paneDocked: true });
    render(<DetailPaneToggle />);

    await user.click(screen.getByRole("button", { name: "Hide the card detail panel" }));

    expect(useDisplayStore.getState().paneDocked).toBe(false);
    expect(useSelectionStore.getState().selectedCard).toBeNull();
  });
});

describe("MobileOptionsDrawer", () => {
  it("stays open when it remounts on the same page", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<MobileOptionsDrawer>Filters</MobileOptionsDrawer>);
    await user.click(screen.getByRole("button", { name: "Options" }));
    expect(await screen.findByRole("dialog", { name: "Options" })).toBeInTheDocument();

    unmount();
    render(<MobileOptionsDrawer>Filters</MobileOptionsDrawer>);

    expect(await screen.findByRole("dialog", { name: "Options" })).toBeInTheDocument();
  });

  it("stays closed on a page other than the one it was opened on", () => {
    useFilterDrawerStore.getState().setOpen(true, "/somewhere-else");
    render(<MobileOptionsDrawer>Filters</MobileOptionsDrawer>);

    expect(screen.queryByRole("dialog", { name: "Options" })).not.toBeInTheDocument();
  });
});
