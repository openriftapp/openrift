import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { stubPrinting } from "@/test/factories";

vi.mock("@/hooks/use-domain-colors", () => ({ useDomainColors: () => ({}) }));
vi.mock("./card-detail-art", () => ({ CardDetailArt: () => null }));
vi.mock("./card-detail-links", () => ({ CardDetailLinks: () => null }));
vi.mock("./card-detail-stats", () => ({ CardDetailStats: () => null }));
vi.mock("./card-detail-text", () => ({ CardDetailText: () => null }));
vi.mock("./card-detail-heading", () => ({
  CardDetailHeading: () => <h2>Chaos Rune</h2>,
}));
vi.mock("./card-footer", () => ({ CardFooter: () => null }));
vi.mock("./card-holdings-section", () => ({ CardHoldingsSection: () => null }));
vi.mock("./printing-picker", () => ({ PrintingPicker: () => null }));
vi.mock("./printing-notes-section", () => ({ PrintingNotesSection: () => null }));

// oxlint-disable-next-line import/first -- must import after vi.mock
const { CardDetail } = await import("./card-detail");

const printing = stubPrinting({ printingId: "p-1", card: { name: "Chaos Rune" } });

describe("CardDetail desktop header", () => {
  it("sticks to the top of the pane when it has a close button", () => {
    render(<CardDetail printing={printing} showImages={false} onClose={() => {}} />);

    const closeButtons = screen.getAllByRole("button", { name: "Close card details" });
    const header = closeButtons.at(-1)?.parentElement;
    expect(header).toHaveClass("sticky", "top-0", "z-10", "backdrop-blur-lg", "md:-mx-3");
  });

  it("scrolls with the content without a close button", () => {
    render(<CardDetail printing={printing} showImages={false} />);

    const heading = screen.getByRole("heading", { name: /Chaos Rune/u });
    expect(heading.closest(".sticky")).toBeNull();
  });
});
