import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, params }: { children?: ReactNode; params: { cardSlug: string } }) => (
    <a href={`/admin/workspace/cards/${params.cardSlug}`}>{children}</a>
  ),
}));

const { PrintingCardLinks } = await import("./printing-card-links");

describe("PrintingCardLinks", () => {
  it("links each card of the printing once to its card page", () => {
    render(
      <PrintingCardLinks
        faces={[
          { cardSlug: "jinx", cardName: "Jinx" },
          { cardSlug: "jinx", cardName: "Jinx" },
        ]}
        pendingCount={0}
      />,
    );

    expect(screen.getByText("Card")).toBeVisible();
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/admin/workspace/cards/jinx",
    ]);
    expect(screen.queryByText(/pending on this printing/u)).toBeNull();
  });

  it("names both cards of a double-faced printing and counts its open suggestions", () => {
    render(
      <PrintingCardLinks
        faces={[
          { cardSlug: "jinx", cardName: "Jinx" },
          { cardSlug: "vi", cardName: "Vi" },
        ]}
        pendingCount={2}
      />,
    );

    expect(screen.getByText("Cards")).toBeVisible();
    expect(screen.getByRole("link", { name: "Vi" })).toHaveAttribute(
      "href",
      "/admin/workspace/cards/vi",
    );
    expect(screen.getByText("2 suggestions pending on this printing")).toBeVisible();
  });
});
