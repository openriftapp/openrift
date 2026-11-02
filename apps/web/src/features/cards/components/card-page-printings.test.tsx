import { sideKey } from "@openrift/shared/printing-side";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { usePrintingLightboxStore } from "@/features/cards/stores/printing-lightbox-store";
import { stubPrinting } from "@/test/factories";

import { CardPagePrintings } from "./card-page-printings";

vi.mock("@/hooks/use-hydrated", () => ({ useHydrated: () => false }));

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({ labels: { finishes: {}, artVariants: {}, cardSizes: {} } }),
  useLanguageLabels: () => ({ EN: "English", FR: "French" }),
}));

vi.mock("@/components/language-chip", () => ({
  LanguageChip: ({ code }: { code: string }) => <span>{code}</span>,
}));

vi.mock("@/features/cards/components/card-art-thumb", () => ({
  CardArtThumb: () => null,
}));

function renderPrintings(artists: string[]) {
  const printings = artists.map((artist, index) =>
    stubPrinting({ language: "EN", shortCode: `OGN-${index}`, artist }),
  );
  render(<CardPagePrintings printings={printings} selectedSideKey="" onSelect={vi.fn()} />);
}

describe("CardPagePrintings", () => {
  it("shows no artist on a row", () => {
    renderPrintings(["League Splash Team", "Kudos Productions"]);
    expect(screen.queryByText("League Splash Team")).toBeNull();
    expect(screen.queryByText("Kudos Productions")).toBeNull();
  });

  it("offers the phone layout one row per design with a pill per language", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const english = stubPrinting({ setId: "set-1", shortCode: "OGN-1", language: "EN" });
    const french = stubPrinting({ setId: "set-1", shortCode: "OGN-1", language: "FR" });
    render(
      <CardPagePrintings
        printings={[english, french]}
        selectedSideKey={english.printingId}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("button", { name: "French" }));

    expect(onSelect).toHaveBeenCalledWith(french);
  });

  it("puts the header action beside the Printings heading", () => {
    const printing = stubPrinting({ language: "EN" });
    render(
      <CardPagePrintings
        printings={[printing]}
        selectedSideKey=""
        onSelect={vi.fn()}
        headerAction={<button type="button">All printings</button>}
      />,
    );

    const header = screen.getByRole("heading", { level: 2 }).parentElement;
    expect(header?.textContent).toContain("All printings");
  });

  it("highlights the printing picked in the lightbox until the animation ends", () => {
    const english = stubPrinting({ setId: "set-1", shortCode: "OGN-1", language: "EN" });
    const french = stubPrinting({ setId: "set-1", shortCode: "OGN-1", language: "FR" });
    usePrintingLightboxStore.setState({ pickedSideKey: sideKey(french) });
    const { container } = render(
      <CardPagePrintings
        printings={[english, french]}
        selectedSideKey={sideKey(french)}
        onSelect={vi.fn()}
      />,
    );

    const cell = container.querySelector(
      `[data-printing-id="${french.printingId}"][data-highlighted]`,
    );
    expect(cell).not.toBeNull();

    fireEvent.animationEnd(cell as Element);

    expect(usePrintingLightboxStore.getState().pickedSideKey).toBeNull();
  });
});
