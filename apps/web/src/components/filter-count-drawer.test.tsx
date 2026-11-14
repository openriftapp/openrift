import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FilterCountDrawer } from "./filter-count-drawer";

describe("FilterCountDrawer", () => {
  it("hides the count badge at zero", () => {
    render(
      <FilterCountDrawer count={0} description="Narrow the list">
        <span>Drawer body</span>
      </FilterCountDrawer>,
    );

    expect(screen.getByRole("button", { name: "Filters" })).not.toHaveTextContent(/\d/u);
  });

  it("shows the count badge above zero", () => {
    render(
      <FilterCountDrawer count={4} description="Narrow the list">
        <span>Drawer body</span>
      </FilterCountDrawer>,
    );

    expect(screen.getByRole("button", { name: "Filters" })).toHaveTextContent("4");
  });

  it("opens on its own when no open state is passed", async () => {
    const user = userEvent.setup();
    render(
      <FilterCountDrawer count={0} description="Narrow the list">
        <span>Drawer body</span>
      </FilterCountDrawer>,
    );
    expect(screen.queryByText("Drawer body")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Filters" }));

    expect(await screen.findByRole("dialog")).toHaveTextContent("Drawer body");
    expect(screen.getByText("Narrow the list")).toBeInTheDocument();
  });

  it("leaves a controlled open state to the caller", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <FilterCountDrawer
        count={0}
        description="Narrow the list"
        open={false}
        onOpenChange={onOpenChange}
      >
        <span>Drawer body</span>
      </FilterCountDrawer>,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));

    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders the body when the caller opens it", () => {
    render(
      <FilterCountDrawer count={0} description="Narrow the list" open>
        <span>Drawer body</span>
      </FilterCountDrawer>,
    );

    expect(screen.getByText("Drawer body")).toBeInTheDocument();
  });
});
