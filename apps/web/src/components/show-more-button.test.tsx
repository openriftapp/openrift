import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ShowMoreButton } from "./show-more-button";

describe("ShowMoreButton", () => {
  it("offers to show all with the count", () => {
    const onClick = vi.fn();
    render(<ShowMoreButton count={1234} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Show all 1,234" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("offers to show fewer once expanded", () => {
    render(<ShowMoreButton count={12} expanded onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Show fewer" })).toBeInTheDocument();
  });

  it("uses a custom label", () => {
    render(<ShowMoreButton onClick={vi.fn()}>Show 20 more</ShowMoreButton>);
    expect(screen.getByRole("button", { name: "Show 20 more" })).toBeInTheDocument();
  });

  it("renders as a link-style button beside a heading", () => {
    render(<ShowMoreButton placement="heading" count={5} onClick={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Show all 5" });
    expect(button).toHaveClass("p-0");
    expect(button.parentElement).not.toHaveClass("justify-center");
  });

  it("disables the button while the next page loads", () => {
    const onClick = vi.fn();
    render(
      <ShowMoreButton pending onClick={onClick}>
        Load more
      </ShowMoreButton>,
    );
    const button = screen.getByRole("button", { name: "Load more" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});
