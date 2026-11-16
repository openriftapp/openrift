import type { ProductSuggestion } from "@openrift/shared/marketplace-suggestions";
import type { UnifiedMappingPrintingResponse } from "@openrift/shared/types/api/admin";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProductSuggestionChip } from "./marketplace-suggestion-chip";

const suggestion = {
  printingId: "p-1",
  score: 200,
  printing: {
    printingId: "p-1",
    shortCode: "OGN-027",
    markerSlugs: [],
    finish: "normal",
    language: "EN",
    size: "standard",
  },
} as unknown as ProductSuggestion & { printing: UnifiedMappingPrintingResponse };

describe("ProductSuggestionChip", () => {
  it("stays busy until its own save settles, however long that takes", async () => {
    const gate = { open: () => {} };
    const onAssign = () =>
      new Promise<void>((resolve) => {
        gate.open = resolve;
      });
    render(
      <ProductSuggestionChip
        suggestion={suggestion}
        productExternalId={7}
        onAssign={onAssign}
        disabled={false}
      />,
    );
    const chip = screen.getByRole("button");

    await userEvent.click(chip);
    expect(chip).toBeDisabled();

    gate.open();
    await vi.waitFor(() => expect(chip).toBeEnabled());
  });
});
