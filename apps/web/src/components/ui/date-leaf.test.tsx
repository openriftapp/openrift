import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DateLeaf } from "./date-leaf";

describe("DateLeaf", () => {
  it("renders preformatted parts as given", () => {
    render(<DateLeaf month="JUL" day="13" caption="2026" />);
    expect(screen.getByText("JUL")).toBeInTheDocument();
    expect(screen.getByText("13")).toBeInTheDocument();
    expect(screen.getByText("2026")).toBeInTheDocument();
  });

  it("formats an instant on the UTC calendar day", () => {
    render(<DateLeaf at="2026-03-01T23:30:00Z" clock="utc" />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("puts the year on the caption line with showYear", () => {
    render(<DateLeaf at="2025-12-31" clock="utc" showYear />);
    expect(screen.getByText("31")).toBeInTheDocument();
    expect(screen.getByText("2025")).toBeInTheDocument();
  });

  it("prefers an explicit caption over the year", () => {
    render(<DateLeaf at="2025-12-31" clock="utc" showYear caption="3 days ago" />);
    expect(screen.getByText("3 days ago")).toBeInTheDocument();
    expect(screen.queryByText("2025")).not.toBeInTheDocument();
  });

  it("formats on the viewer's clock with clock local", () => {
    const at = new Date(2026, 6, 13, 12, 0);
    render(<DateLeaf at={at} clock="local" />);
    expect(screen.getByText("13")).toBeInTheDocument();
  });

  it("renders an empty leaf for an unparseable date", () => {
    const { container } = render(<DateLeaf at="not a date" clock="utc" />);
    expect(container.querySelector("[data-slot=date-leaf]")).toBeInTheDocument();
    expect(screen.queryByText("NaN")).not.toBeInTheDocument();
  });
});
