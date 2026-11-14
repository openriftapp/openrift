import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScanLoadRow } from "@/features/scan/components/scan-load-row";

describe("ScanLoadRow", () => {
  it("stops spinning and drops the progress once the load failed", () => {
    const { container } = render(
      <ScanLoadRow
        label="Card bank"
        done={false}
        failed
        progress={{ loaded: 5, total: 10, ready: false }}
      />,
    );

    expect(screen.getByText("Card bank")).toBeInTheDocument();
    expect(container.querySelector("[data-slot=spinner]")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});
