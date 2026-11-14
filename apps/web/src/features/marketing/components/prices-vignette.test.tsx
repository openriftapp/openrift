import { MARKETPLACE_LINKS } from "@openrift/shared/marketplace";
import { ALL_MARKETPLACES } from "@openrift/shared/types/pricing";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PricesVignette } from "./prices-vignette";

describe("PricesVignette", () => {
  it("prices the card on every marketplace the product lists", () => {
    render(<PricesVignette />);

    expect(screen.getAllByRole("listitem")).toHaveLength(ALL_MARKETPLACES.length);
    for (const marketplace of ALL_MARKETPLACES) {
      expect(screen.getByText(MARKETPLACE_LINKS[marketplace].label)).toBeInTheDocument();
    }
  });

  it("renders nothing a visitor could press", () => {
    const { container } = render(<PricesVignette />);

    expect(container.querySelectorAll("button, input, a, [role=button]")).toHaveLength(0);
  });

  it("labels the time ranges like the product chart", () => {
    render(<PricesVignette />);

    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("30D")).toBeInTheDocument();
  });
});
