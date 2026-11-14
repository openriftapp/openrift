import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IMPORT_SAMPLE_LINES } from "@/features/marketing/lib/vignette-fixtures";

import { ImportVignette } from "./import-vignette";

describe("ImportVignette", () => {
  it("shows the export the real importer accepts, line for line", () => {
    render(<ImportVignette />);

    for (const line of IMPORT_SAMPLE_LINES) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
  });
});
