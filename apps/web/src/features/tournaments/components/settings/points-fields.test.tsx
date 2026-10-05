import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { parsePointsInput, PointsFields, pointsInputInvalid } from "./points-fields";

const DEFAULTS = { win: "3", draw: "1", bye: "3" };

describe("parsePointsInput", () => {
  it("accepts one or two digits, trimmed", () => {
    expect(parsePointsInput("0")).toBe(0);
    expect(parsePointsInput(" 99 ")).toBe(99);
  });

  it("rejects blanks, signs, decimals and three digits", () => {
    for (const text of ["", "-1", "1.5", "100", "x"]) {
      expect(parsePointsInput(text)).toBeNull();
    }
  });
});

describe("pointsInputInvalid", () => {
  it("ignores win and draw outside Swiss", () => {
    expect(pointsInputInvalid({ win: "", draw: "x", bye: "3" }, false)).toBe(false);
  });

  it("checks win and draw under Swiss", () => {
    expect(pointsInputInvalid({ ...DEFAULTS, draw: "" }, true)).toBe(true);
  });

  it("always checks the bye", () => {
    expect(pointsInputInvalid({ ...DEFAULTS, bye: "100" }, false)).toBe(true);
  });
});

describe("PointsFields", () => {
  it("reports an edited value as a patch", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PointsFields value={DEFAULTS} swiss onChange={onChange} />);

    await user.type(screen.getByLabelText("Points for a draw"), "2");

    expect(onChange).toHaveBeenCalledWith({ draw: "12" });
  });

  it("shows only the bye outside Swiss", () => {
    render(<PointsFields value={DEFAULTS} swiss={false} onChange={vi.fn()} />);

    expect(screen.getByLabelText("Points for a bye")).toBeInTheDocument();
    expect(screen.queryByLabelText("Points for a match win")).not.toBeInTheDocument();
  });

  it("explains an out-of-range value", () => {
    render(<PointsFields value={{ ...DEFAULTS, win: "100" }} swiss onChange={vi.fn()} />);

    expect(screen.getByText(/whole numbers between 0 and 99/u)).toBeInTheDocument();
  });

  it("renders the action in the input row", () => {
    render(
      <PointsFields
        value={DEFAULTS}
        swiss={false}
        action={<button type="button">Save</button>}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });
});
