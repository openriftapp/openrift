import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FIXTURE_VARIANT_RAIL } from "@/features/marketing/lib/vignette-fixtures";

import { VariantsVignette } from "./variants-vignette";

function nodeOf(label: string): HTMLElement {
  const node = screen.getAllByText(label)[0]?.closest(String.raw`span.-translate-y-1\/2`);
  if (!(node instanceof HTMLElement)) {
    throw new TypeError(`no rail node for ${label}`);
  }
  return node;
}

describe("VariantsVignette rail", () => {
  it("shrinks to its column, so a phone sees all three variants without scrolling", () => {
    const { container } = render(<VariantsVignette />);
    const rail = container.querySelector("svg")?.parentElement;

    expect(rail?.style.width).toBe("");
    expect(rail?.style.maxWidth).toBe("384px");
    expect(rail?.parentElement?.className).not.toContain("overflow-x-auto");
  });

  it("places the variants by share of the rail width", () => {
    render(<VariantsVignette />);

    expect(nodeOf(FIXTURE_VARIANT_RAIL.root.label).style.left).toBe("15.625%");
    expect(nodeOf(FIXTURE_VARIANT_RAIL.head.label).style.left).toBe("50%");
    expect(nodeOf(FIXTURE_VARIANT_RAIL.fork.label).style.left).toBe("84.375%");
  });
});
