import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PromosVignette } from "./promos-vignette";

describe("PromosVignette", () => {
  it("requests no rarity icon for the placeholder rows", () => {
    const { container } = render(<PromosVignette />);

    expect(container.querySelectorAll("img")).toHaveLength(0);
  });

  it("shows the rarity icon of a loaded printing", () => {
    const { container } = render(
      <PromosVignette
        sections={[
          {
            path: ["Promos"],
            printingCount: 1,
            printings: [
              { imageId: "", name: "Jinx", shortCode: "OGN-001", rarity: "rare", markers: [] },
            ],
          },
        ]}
      />,
    );

    expect(container.querySelector('img[src*="/images/rarities/rare"]')).not.toBeNull();
  });
});
