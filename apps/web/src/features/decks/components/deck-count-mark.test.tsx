import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DeckCountMark } from "./deck-count-mark";

describe("DeckCountMark", () => {
  it("draws the gold in-deck frame", () => {
    const { container } = render(<DeckCountMark />);
    expect(container.firstElementChild?.className).toContain("ring-primary");
  });
});
