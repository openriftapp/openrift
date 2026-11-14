import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RailNodeDate } from "./deck-variant-rail-date";

describe("RailNodeDate", () => {
  it("keeps the whole day on one line under the dot", () => {
    render(<RailNodeDate updatedAt="2026-08-01T12:00:00.000Z" />);
    expect(screen.getByText("2026-08-01")).toHaveClass("whitespace-nowrap");
  });

  it("renders nothing without a date", () => {
    const { container } = render(<RailNodeDate updatedAt={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
