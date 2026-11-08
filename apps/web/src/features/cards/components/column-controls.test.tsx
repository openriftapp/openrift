import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ColumnControls } from "./column-controls";

describe("ColumnControls", () => {
  it("sizes every compact button from the touch-aware small control height", () => {
    render(
      <ColumnControls
        compact
        maxColumns={null}
        autoColumns={4}
        minColumns={1}
        maxColumnsLimit={8}
        onMaxColumnsChange={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      expect(button.className).toMatch(/\bh-\(--control-h-sm\)|\bsize-\(--control-h-sm\)/u);
      expect(button).not.toHaveClass("size-7");
    }
  });
});
