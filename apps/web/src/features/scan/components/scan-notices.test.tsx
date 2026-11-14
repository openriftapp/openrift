import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScanNotices } from "./scan-notices";

describe("ScanNotices", () => {
  it("pads the unavailable sentence only by the card's own even spacing", () => {
    render(<ScanNotices unavailable scanError={null} cameraAvailable />);
    const content = screen
      .getByText("The scanner is not available right now. Please try again later.")
      .closest('[data-slot="card-content"]');
    expect(content).not.toBeNull();
    expect(content?.className).not.toMatch(/\bp[ty]-/u);
  });
});
