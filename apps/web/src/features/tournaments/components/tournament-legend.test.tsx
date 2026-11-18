import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-hydrated", () => ({ useHydrated: () => true }));

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({
    orders: { domains: ["fury", "calm"] },
    labels: { domains: { fury: "Fury", calm: "Calm" } },
  }),
}));

vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({
    printingsByCardId: new Map([
      [
        "lux",
        [
          {
            card: {
              name: "Lux, Lady of Luminosity",
              slug: "lux",
              domains: ["fury", "calm"],
              tags: ["Lux"],
              types: ["legend"],
            },
          },
        ],
      ],
    ]),
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/cards/lux">{children}</a>,
}));

const { TournamentLegend } = await import("./tournament-legend");

describe("TournamentLegend", () => {
  it("shows the legend's domain runes", () => {
    render(<TournamentLegend legendCardId="lux" championOnly />);
    expect(screen.getByAltText("Fury")).toBeInTheDocument();
  });
});
