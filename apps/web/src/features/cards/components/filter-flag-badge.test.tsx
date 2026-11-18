import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FlagBadge } from "./filter-flag-badge";

describe("FlagBadge", () => {
  it("names an excluded chip as excluded", () => {
    render(<FlagBadge label="Signed" state={false} onClick={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Signed (excluded)" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("names an excluded bar button as excluded", () => {
    render(<FlagBadge label="Signed" state={false} onClick={vi.fn()} triggerStyle="button" />);

    expect(screen.getByRole("button", { name: "Signed (excluded)" })).toBeInTheDocument();
  });

  it("keeps the plain name while unset or included", () => {
    const { rerender } = render(<FlagBadge label="Signed" state={null} onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Signed" })).toHaveAttribute("aria-pressed", "false");

    rerender(<FlagBadge label="Signed" state onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Signed" })).toHaveAttribute("aria-pressed", "true");
  });
});
