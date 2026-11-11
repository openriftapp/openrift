import { sideKey } from "@openrift/shared/printing-side";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { usePrintingLightboxStore } from "@/features/cards/stores/printing-lightbox-store";
import { stubPrinting } from "@/test/factories";

import { CardPagePrintings, PrintingLanguageMatrix } from "./card-page-printings";

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

vi.mock("@/features/cards/components/card-detail/card-detail-art", () => ({
  CardDetailArt: () => null,
}));

vi.mock("@/hooks/use-session", () => ({ useUserId: () => null }));

const viewport = vi.hoisted(() => ({ mobile: false }));
vi.mock("@/hooks/use-is-mobile", () => ({ useIsMobile: () => viewport.mobile }));

const catalog = vi.hoisted(() => ({ printingsByCardId: new Map<string, unknown[]>() }));
vi.mock("@/features/cards/hooks/use-cards", () => ({ useCards: () => catalog }));
vi.mock("@/features/cards/hooks/use-prices", () => ({
  usePrices: () => ({ get: () => undefined }),
}));
vi.mock("@/features/collections/hooks/use-owned-count", () => ({
  useOwnedCountsForPrintings: () => ({ data: undefined }),
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

  it.each([
    [false, 1],
    [true, 0],
  ])("scrolls up to the hero after a pick unless on a phone (mobile %s)", async (mobile, calls) => {
    viewport.mobile = mobile;
    const scrollTo = vi.spyOn(globalThis, "scrollTo").mockImplementation(() => {});
    const onSelect = vi.fn();
    const english = stubPrinting({ setId: "set-1", shortCode: "OGN-1", language: "EN" });
    const french = stubPrinting({ setId: "set-1", shortCode: "OGN-1", language: "FR" });
    render(
      <CardPagePrintings
        printings={[english, french]}
        selectedSideKey={sideKey(english)}
        onSelect={onSelect}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "French" }));

    expect(onSelect).toHaveBeenCalledWith(french);
    expect(scrollTo).toHaveBeenCalledTimes(calls);
    scrollTo.mockRestore();
    viewport.mobile = false;
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

  it("offers the flip to the other face on a double-sided printing in the large table", async () => {
    const front = stubPrinting({
      printingId: "p-ds",
      cardId: "front-card",
      setId: "set-1",
      shortCode: "OGN-2",
      language: "EN",
      side: 1,
      otherSide: {
        faceId: "face-2",
        cardId: "back-card",
        cardName: "Back Card",
        cardSlug: "back-card",
        shortCode: "OGN-2",
      },
    });
    const back = stubPrinting({
      printingId: "p-ds",
      cardId: "back-card",
      card: { name: "Back Card" },
      side: 2,
    });
    catalog.printingsByCardId = new Map([["back-card", [back]]]);
    render(<PrintingLanguageMatrix printings={[front]} onSelect={vi.fn()} />);

    expect(await screen.findByRole("button", { name: "Flip to Back Card" })).toBeTruthy();
  });

  it("dims a printing that has no image of its own", () => {
    const pictured = stubPrinting({
      setId: "set-1",
      shortCode: "OGN-1",
      language: "EN",
      images: [{ imageId: "img-en" }],
    });
    const placeholder = stubPrinting({
      setId: "set-1",
      shortCode: "OGN-1",
      language: "FR",
      images: [],
    });
    const { container } = render(
      <PrintingLanguageMatrix printings={[pictured, placeholder]} onSelect={vi.fn()} />,
    );

    const dimmed = (printingId: string) =>
      container.querySelector(`[data-printing-id="${printingId}"] .opacity-60`);
    expect(dimmed(placeholder.printingId)).not.toBeNull();
    expect(dimmed(pictured.printingId)).toBeNull();
  });

  it("hands a tapped header language to onLanguageSelect", async () => {
    const onLanguageSelect = vi.fn();
    const english = stubPrinting({ setId: "set-1", shortCode: "OGN-1", language: "EN" });
    const french = stubPrinting({ setId: "set-1", shortCode: "OGN-1", language: "FR" });
    render(
      <PrintingLanguageMatrix
        printings={[english, french]}
        onSelect={vi.fn()}
        onLanguageSelect={onLanguageSelect}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "French" }));

    expect(onLanguageSelect).toHaveBeenCalledWith("FR");
  });

  it("marks the shown printing in the large table", () => {
    const english = stubPrinting({ setId: "set-1", shortCode: "OGN-1", language: "EN" });
    const french = stubPrinting({ setId: "set-1", shortCode: "OGN-1", language: "FR" });
    const { container } = render(
      <CardPagePrintings
        printings={[english, french]}
        selectedSideKey={sideKey(french)}
        onSelect={vi.fn()}
      />,
    );

    const cell = (printingId: string) =>
      container.querySelector(`.md\\:block [data-printing-id="${printingId}"]`);
    expect(cell(french.printingId)).toHaveAttribute("aria-pressed", "true");
    expect(cell(english.printingId)).toHaveAttribute("aria-pressed", "false");
  });

  it("leaves every cell unmarked when no printing is shown", () => {
    const english = stubPrinting({ setId: "set-1", shortCode: "OGN-1", language: "EN" });
    const { container } = render(
      <PrintingLanguageMatrix printings={[english]} onSelect={vi.fn()} />,
    );

    const cell = container.querySelector(`[data-printing-id="${english.printingId}"]`);
    expect(cell).not.toBeNull();
    expect(cell).not.toHaveAttribute("aria-pressed");
  });

  it("hands a tapped design to onDesignSelect", async () => {
    const onDesignSelect = vi.fn();
    const onSelect = vi.fn();
    const english = stubPrinting({ setId: "set-1", shortCode: "OGN-1", language: "EN" });
    const french = stubPrinting({ setId: "set-1", shortCode: "OGN-1", language: "FR" });
    const { container } = render(
      <PrintingLanguageMatrix
        printings={[english, french]}
        onSelect={onSelect}
        onDesignSelect={onDesignSelect}
      />,
    );

    const info = container.querySelector("li")?.firstElementChild;
    if (!(info instanceof HTMLElement)) {
      throw new TypeError("no design button");
    }
    await userEvent.click(info);

    expect(onDesignSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("pins the language header when asked", () => {
    const english = stubPrinting({ setId: "set-1", shortCode: "OGN-1", language: "EN" });
    const french = stubPrinting({ setId: "set-1", shortCode: "OGN-1", language: "FR" });
    render(
      <PrintingLanguageMatrix printings={[english, french]} onSelect={vi.fn()} stickyHeader />,
    );

    const header = screen.getByText("FR").closest(".sticky");
    expect(header).not.toBeNull();
    expect(header?.parentElement?.className).not.toContain("overflow-hidden");
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
