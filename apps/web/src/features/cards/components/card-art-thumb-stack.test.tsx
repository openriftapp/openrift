// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CardArtThumbStack } from "./card-art-thumb-stack";

describe("CardArtThumbStack", () => {
  it("rotates landscape (Battlefield) items and leaves portrait ones upright", () => {
    const { container } = render(
      <CardArtThumbStack
        items={[
          { key: "bf", imageId: "image-bf", landscape: true },
          { key: "unit", imageId: "image-unit" },
        ]}
      />,
    );
    const [battlefield, unit] = container.querySelectorAll("img");
    expect(battlefield?.parentElement?.style.transform).toContain("rotate(-90deg)");
    expect(unit?.parentElement?.style.transform ?? "").not.toContain("rotate");
  });

  it("counts the items past the cap in a pill", () => {
    const items = Array.from({ length: 7 }, (_, index) => ({
      key: `item-${index}`,
      imageId: `image-${index}`,
    }));
    const { container, getByText } = render(<CardArtThumbStack items={items} max={5} />);
    expect(container.querySelectorAll("img")).toHaveLength(5);
    expect(getByText("+2")).toBeInTheDocument();
  });
});
