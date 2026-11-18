import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SortGroupControls } from "./sort-group-controls";

const SORT_OPTIONS = [
  { value: "id", label: "ID" },
  { value: "name", label: "Name" },
];

const PROMO_GROUP_OPTIONS = [
  { value: "channel", label: "Distribution Channel" },
  { value: "card", label: "Card" },
  { value: "year", label: "Year" },
  { value: "marker", label: "Marker" },
];

const NOOP = () => {};

describe("SortGroupControls — group label resolution", () => {
  it("uses the option label when value matches a known option", () => {
    const { container } = render(
      <SortGroupControls
        sortOptions={SORT_OPTIONS}
        sortBy="id"
        sortDir="asc"
        onSortByChange={NOOP}
        onSortDirChange={NOOP}
        group={{
          options: PROMO_GROUP_OPTIONS,
          value: "channel",
          dir: "asc",
          onValueChange: NOOP,
          onDirChange: NOOP,
        }}
      />,
    );
    expect(container.textContent).toContain("Distribution Channel");
    expect(container.textContent).not.toContain("channel ·");
  });

  it("falls back to the raw value when value isn't in the options list (avoid this at the surface)", () => {
    const { container } = render(
      <SortGroupControls
        sortOptions={SORT_OPTIONS}
        sortBy="id"
        sortDir="asc"
        onSortByChange={NOOP}
        onSortDirChange={NOOP}
        group={{
          options: PROMO_GROUP_OPTIONS,
          value: "set",
          dir: "asc",
          onValueChange: NOOP,
          onDirChange: NOOP,
        }}
      />,
    );
    expect(container.textContent).toContain("set");
  });
});

describe("SortGroupControls accessible names", () => {
  it("labels the group and sort direction toggles apart in the compact layout", () => {
    render(
      <SortGroupControls
        compact
        sortOptions={SORT_OPTIONS}
        sortBy="id"
        sortDir="asc"
        onSortByChange={NOOP}
        onSortDirChange={NOOP}
        group={{
          options: PROMO_GROUP_OPTIONS,
          value: "channel",
          dir: "desc",
          onValueChange: NOOP,
          onDirChange: NOOP,
        }}
      />,
    );
    expect(screen.getByRole("button", { name: "Ascending, click to reverse" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Groups descending, click to reverse" }),
    ).toBeTruthy();
  });

  it("renders option badges as pressed-state buttons", () => {
    const onSortByChange = vi.fn();
    render(
      <SortGroupControls
        compact
        sortOptions={SORT_OPTIONS}
        sortBy="id"
        sortDir="asc"
        onSortByChange={onSortByChange}
        onSortDirChange={NOOP}
      />,
    );
    expect(screen.getByRole("button", { name: "ID" }).getAttribute("aria-pressed")).toBe("true");
    const name = screen.getByRole("button", { name: "Name" });
    expect(name.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(name);
    expect(onSortByChange).toHaveBeenCalledWith("name");
  });
});
