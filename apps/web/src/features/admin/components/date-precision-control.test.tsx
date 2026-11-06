import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DatePrecisionControl } from "./date-precision-control";

describe("DatePrecisionControl", () => {
  it("offers day, month and year by default", () => {
    render(<DatePrecisionControl value="day" onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Year" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quarter" })).not.toBeInTheDocument();
  });

  it("offers quarter when asked", () => {
    render(<DatePrecisionControl value="quarter" onChange={vi.fn()} includeQuarter />);

    expect(screen.getByRole("button", { name: "Quarter" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows a stored quarter as month when quarter is not offered", () => {
    render(<DatePrecisionControl value="quarter" onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Month" })).toHaveAttribute("aria-pressed", "true");
  });

  it("reports the picked precision", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePrecisionControl value="day" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Year" }));

    expect(onChange).toHaveBeenCalledWith("year");
  });

  it("ignores clicks while disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePrecisionControl value="day" onChange={onChange} disabled />);

    await user.click(screen.getByRole("button", { name: "Year" }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
