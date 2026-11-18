import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { FilterSign } from "@/lib/filter-sign";

import { FilterSection } from "./filter-badge-row";

function renderSection(selected: string[], excluded: string[], sign: FilterSign | null) {
  const onSignedToggle = vi.fn();
  const onSignFlip = vi.fn();
  render(
    <FilterSection
      label="Finish"
      options={["normal", "foil"]}
      selected={selected}
      excluded={excluded}
      signed={{ sign, onSignedToggle, onSignFlip }}
    />,
  );
  return { onSignedToggle, onSignFlip };
}

describe("FilterSection with include/exclude", () => {
  it("includes a clicked pill on an empty dimension and shows no flip pill", async () => {
    const user = userEvent.setup();
    const { onSignedToggle } = renderSection([], [], null);

    expect(screen.queryByText("Exclude instead")).not.toBeInTheDocument();
    await user.click(screen.getByText("foil"));

    expect(onSignedToggle).toHaveBeenCalledExactlyOnceWith("foil", "include");
  });

  it("toggles a pill on the dimension's exclude sign", async () => {
    const user = userEvent.setup();
    const { onSignedToggle } = renderSection([], ["foil"], "exclude");

    await user.click(screen.getByText("normal"));

    expect(onSignedToggle).toHaveBeenCalledExactlyOnceWith("normal", "exclude");
  });

  it("flips an including dimension through its Exclude instead pill", async () => {
    const user = userEvent.setup();
    const { onSignFlip } = renderSection(["foil"], [], "include");

    await user.click(screen.getByText("Exclude instead"));

    expect(onSignFlip).toHaveBeenCalledOnce();
  });

  it("offers Include instead on an excluding dimension", () => {
    renderSection([], ["foil"], "exclude");
    expect(screen.getByText("Include instead")).toBeInTheDocument();
  });

  it("strikes an excluded pill through without a minus icon", () => {
    renderSection([], ["foil"], "exclude");
    const pill = screen.getByText("foil").parentElement;
    expect(pill).toHaveClass("line-through");
    expect(pill?.querySelector("svg.lucide-minus")).toBeNull();
  });
});

describe("FilterSection option controls", () => {
  it("exposes each option as a button with its selected state", () => {
    renderSection(["foil"], [], "include");

    expect(screen.getByRole("button", { name: "foil" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "normal" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("names an excluded option as excluded", () => {
    renderSection([], ["foil"], "exclude");

    expect(screen.getByRole("button", { name: "foil (excluded)" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "normal" })).toBeInTheDocument();
  });
});
