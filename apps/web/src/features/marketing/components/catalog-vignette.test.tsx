import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children?: ReactNode }) => <a href={to}>{children}</a>,
}));

const { CatalogVignette } = await import("./catalog-vignette");

const SAMPLE = [
  { url: "/a.webp", rarity: "common", domains: ["fury"] },
  { url: "/b.webp", rarity: "epic", domains: ["calm", "mind"] },
].map((thumb) => ({ ...thumb, name: "", shortCode: "", variantLabel: null, price: null }));

describe("CatalogVignette facet chips", () => {
  it("leaves every chip enabled while the sample is still empty", () => {
    render(<CatalogVignette cards={[]} />);

    for (const label of ["Fury", "Calm", "Chaos", "Common", "Showcase"]) {
      expect(screen.getByLabelText(label)).toBeEnabled();
    }
  });

  it("disables the facets the sample has no card for", () => {
    render(<CatalogVignette cards={SAMPLE} />);

    expect(screen.getByLabelText("Fury")).toBeEnabled();
    expect(screen.getByLabelText("Calm")).toBeEnabled();
    expect(screen.getByLabelText("Chaos")).toBeDisabled();
    expect(screen.getByLabelText("Common")).toBeEnabled();
    expect(screen.getByLabelText("Showcase")).toBeDisabled();
  });
});
