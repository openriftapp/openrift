import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, className }: { children?: ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

const { AuthDestinationPanel } = await import("./auth-destination-panel");

describe("AuthDestinationPanel", () => {
  it("lists the label and every perk", () => {
    render(
      <AuthDestinationPanel
        destination={{
          label: "Groups",
          title: "Sign in to open your groups",
          perks: ["First perk.", "Second perk."],
        }}
      />,
    );

    expect(screen.getByText("Groups")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "First perk.",
      "Second perk.",
    ]);
  });

  it("links to the card browser and the deck builder, which need no account", () => {
    render(<AuthDestinationPanel destination={{ label: "Groups", title: "", perks: [] }} />);

    expect(screen.getByRole("link", { name: "browse cards" })).toHaveAttribute("href", "/cards");
    expect(screen.getByRole("link", { name: "build decks" })).toHaveAttribute("href", "/decks");
  });
});
