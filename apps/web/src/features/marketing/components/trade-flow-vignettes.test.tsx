import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  TradeArrivedVignette,
  TradeRequestVignette,
  TradeReservedVignette,
} from "./trade-flow-vignettes";

describe("trade flow vignettes", () => {
  it("draws empty card frames without an image request when there is no sample card", () => {
    const { container } = render(
      <>
        <TradeRequestVignette />
        <TradeReservedVignette />
        <TradeArrivedVignette />
      </>,
    );

    expect(container.querySelectorAll('img[src=""]')).toHaveLength(0);
    expect(container.querySelectorAll("span.aspect-card")).toHaveLength(3);
  });

  it("shows the sample card art when there is one", () => {
    const card = {
      url: "/sample.webp",
      name: "Jinx",
      shortCode: "OGN-001",
      variantLabel: null,
      rarity: "common",
      domains: [],
      price: null,
    };
    const { container } = render(<TradeArrivedVignette card={card} />);

    expect(container.querySelector('img[src="/sample.webp"]')).not.toBeNull();
  });
});
