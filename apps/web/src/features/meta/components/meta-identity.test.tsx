import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({
    orders: { domains: ["fury", "calm"] },
    labels: { domains: { fury: "Fury", calm: "Calm" } },
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
  }: {
    to: string;
    params: Record<string, string>;
    children: React.ReactNode;
  }) => (
    <a
      href={Object.entries(params)
        .reduce((path, [key, value]) => path.replace(`$${key}`, value), to)
        .replaceAll(/\/\{-\$[^}]+\}/gu, "")}
    >
      {children}
    </a>
  ),
}));

const { MetaIdentity } = await import("./meta-identity");

const LUX = { character: "Lux", epithet: "Lady of Luminosity" };

describe("MetaIdentity", () => {
  it("names a legend by champion and card title", () => {
    render(<MetaIdentity legend={LUX} />);
    expect(screen.getByText("Lux")).toBeInTheDocument();
    expect(screen.getByText("Lady of Luminosity")).toBeInTheDocument();
  });

  it("keeps the card title in every arrangement", () => {
    for (const layout of ["row", "stacked", "tile"] as const) {
      const { unmount } = render(<MetaIdentity legend={LUX} layout={layout} />);
      expect(screen.getByText("Lady of Luminosity")).toBeInTheDocument();
      unmount();
    }
  });

  it("drops the card title only when the bracket asks for it", () => {
    render(<MetaIdentity legend={LUX} championOnly />);
    expect(screen.getByText("Lux")).toBeInTheDocument();
    expect(screen.queryByText("Lady of Luminosity")).not.toBeInTheDocument();
  });

  it("renders an untagged legend as its whole name", () => {
    render(<MetaIdentity legend={{ character: null, epithet: "Emperor of the Sands" }} />);
    expect(screen.getByText("Emperor of the Sands")).toBeInTheDocument();
  });

  it("renders nothing without a legend name", () => {
    const { container } = render(<MetaIdentity legend={{ character: null, epithet: null }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the domain runes by their labels", () => {
    render(<MetaIdentity legend={LUX} domains={["fury", "calm"]} />);
    expect(screen.getByAltText("Fury")).toBeInTheDocument();
    expect(screen.getByAltText("Calm")).toBeInTheDocument();
  });

  it("links the champion at the card page when given a slug", () => {
    render(<MetaIdentity legend={LUX} slug="lady-of-luminosity" />);
    expect(screen.getByRole("link", { name: "Lux" })).toHaveAttribute(
      "href",
      "/cards/lady-of-luminosity",
    );
  });

  it("leads to the legend's archive page when the payload carries its key", () => {
    render(
      <MetaIdentity legend={LUX} slug="lady-of-luminosity" archiveSlug="lux-lady-of-luminosity" />,
    );
    expect(screen.getByRole("link", { name: "Lux" })).toHaveAttribute(
      "href",
      "/meta/legends/lux-lady-of-luminosity",
    );
  });

  it("falls back to the card page for a ref with no archive page, never a guessed key", () => {
    render(
      <MetaIdentity
        legend={{ character: "Garen", epithet: "Crownguard" }}
        slug="garen-crownguard"
        archiveSlug={null}
      />,
    );
    expect(screen.getByRole("link", { name: "Garen" })).toHaveAttribute(
      "href",
      "/cards/garen-crownguard",
    );
  });

  it("stays unlinked without a slug, so it can sit inside a link", () => {
    render(<MetaIdentity legend={LUX} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders nothing without a legend", () => {
    const { container } = render(<MetaIdentity legend={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
