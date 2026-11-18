import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PriceTablePlaceholder } from "./pricing";

describe("PriceTablePlaceholder", () => {
  it("renders its marketplace rows disabled on the server", () => {
    const html = renderToString(
      <PriceTablePlaceholder selected="tcgplayer" onSelect={vi.fn()} hideHeading />,
    );
    const container = document.createElement("div");
    container.innerHTML = html;

    const rows = container.querySelectorAll("button[aria-pressed]");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toBeDisabled();
    }
  });

  it("enables its marketplace rows on the client", () => {
    render(<PriceTablePlaceholder selected="tcgplayer" onSelect={vi.fn()} hideHeading />);

    for (const row of screen.getAllByRole("button", { pressed: false })) {
      expect(row).toBeEnabled();
    }
  });
});
