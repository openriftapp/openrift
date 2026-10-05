import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({
    labels: { domains: { fury: "Fury" }, rarities: { epic: "Epic" } },
  }),
}));

const { DomainIcon } = await import("./domain-icon");
const { FilterIcon } = await import("./filter-icon");
const { RarityIcon } = await import("./rarity-icon");

describe("RarityIcon", () => {
  it("renders the thumbnail gem as a decorative image", () => {
    const { container } = render(<RarityIcon rarity="epic" />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "/images/rarities/epic-28x28.webp");
    expect(img).toHaveAttribute("alt", "");
  });

  it("names the rarity by its label when labelled", () => {
    render(<RarityIcon rarity="epic" labelled />);
    expect(screen.getByAltText("Epic")).toBeInTheDocument();
  });

  it("loads the full artwork on request", () => {
    const { container } = render(<RarityIcon rarity="epic" size="full" />);
    expect(container.querySelector("img")).toHaveAttribute("src", "/images/rarities/epic.webp");
  });
});

describe("FilterIcon", () => {
  it("masks an SVG glyph so it takes the text color", () => {
    const { container } = render(<FilterIcon category="types" value="Unit" />);
    expect(container.querySelector("span")).toHaveStyle({
      maskImage: "url(/images/types/unit.svg)",
    });
  });

  it("renders nothing for a value without a glyph", () => {
    const { container } = render(<FilterIcon category="types" value="other" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for a category without glyphs", () => {
    const { container } = render(<FilterIcon category="finishes" value="foil" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("DomainIcon without a tooltip", () => {
  it("renders the labelled image with no tooltip trigger", () => {
    const { container } = render(<DomainIcon domain="fury" tooltip={false} />);
    expect(screen.getByAltText("Fury")).toBeInTheDocument();
    expect(container.querySelector("[data-slot=tooltip-trigger]")).toBeNull();
  });
});
