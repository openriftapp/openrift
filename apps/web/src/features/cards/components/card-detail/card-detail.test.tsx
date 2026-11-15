import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { stubPrinting } from "@/test/factories";

vi.mock("@/hooks/use-domain-colors", () => ({ useDomainColors: () => ({}) }));
vi.mock("./card-detail-art", () => ({
  CardDetailArt: ({ frame }: { frame?: string }) => <div data-testid="art" data-frame={frame} />,
}));
vi.mock("./card-detail-links", () => ({ CardDetailLinks: () => null, CardPageButton: () => null }));
vi.mock("./card-detail-stats", () => ({ CardDetailStats: () => null }));
vi.mock("./card-detail-text", () => ({ CardDetailText: () => null }));
vi.mock("./card-detail-heading", () => ({
  CardDetailHeading: () => <h2>Chaos Rune</h2>,
}));
vi.mock("./card-footer", () => ({ CardFooter: () => null }));
vi.mock("./card-holdings-section", () => ({ CardHoldingsSection: () => null }));
vi.mock("./card-detail-printing-list", () => ({ CardDetailPrintingList: () => null }));
vi.mock("./printing-notes-section", () => ({ PrintingNotesSection: () => null }));

const { CardDetail } = await import("./card-detail");

const printing = stubPrinting({ printingId: "p-1", card: { name: "Chaos Rune" } });

describe("CardDetail desktop header", () => {
  it("sticks to the top of the pane when it has a close button", () => {
    render(<CardDetail printing={printing} showImages={false} onClose={() => {}} />);

    const closeButtons = screen.getAllByRole("button", { name: "Close card details" });
    const header = closeButtons.at(-1)?.parentElement;
    expect(header).toHaveClass("bg-background", "sticky", "top-0", "z-10", "md:-mx-3");
  });

  it("scrolls with the content without a close button", () => {
    render(<CardDetail printing={printing} showImages={false} />);

    const heading = screen.getByRole("heading", { name: /Chaos Rune/u });
    expect(heading.closest(".sticky")).toBeNull();
  });
});

describe("CardDetail art", () => {
  it.each(["pane", "modal"] as const)(
    "draws the art in its native orientation in the %s layout",
    (layout) => {
      render(<CardDetail printing={printing} showImages={false} layout={layout} />);

      expect(screen.getByTestId("art")).toHaveAttribute("data-frame", "native");
    },
  );
});
