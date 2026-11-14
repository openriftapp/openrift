import type { Printing } from "@openrift/shared/types/catalog";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RenderedSectionProps } from "@/features/cards/components/promo-section-grid";
import { stubPrinting } from "@/test/factories";

vi.mock("@/features/cards/components/promo-card-thumbnail", () => ({
  PromoCardThumbnail: ({ printing }: { printing: Printing }) => (
    <div data-testid="thumbnail">{printing.printingId}</div>
  ),
}));

vi.mock("@/features/cards/components/promo-list-view", () => ({
  PromoListView: ({ printings, showChannel }: { printings: Printing[]; showChannel?: boolean }) => (
    <div data-testid="list">{`${printings.length} rows, channel ${String(showChannel ?? false)}`}</div>
  ),
}));

vi.mock("@/features/cards/components/promo-channel-intro", () => ({
  PromoChannelIntro: ({ description }: { description: string }) => <p>{description}</p>,
}));

const { PromoPrintingsSection } = await import("./promo-printings-section");

function sectionProps(overrides: Partial<RenderedSectionProps> = {}): RenderedSectionProps {
  return {
    stickyOffset: 0,
    viewMode: "grid",
    showImages: true,
    display: {} as RenderedSectionProps["display"],
    grid: { className: "grid", style: {} },
    onCardClick: vi.fn(),
    ownedCounts: undefined,
    sortPrintings: (printings) => printings,
    setNameBySlug: new Map(),
    ...overrides,
  };
}

describe("PromoPrintingsSection", () => {
  it("renders nothing when no printings remain", () => {
    const { container } = render(
      <PromoPrintingsSection sectionId="s" title="Prerelease" printings={[]} {...sectionProps()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("counts distinct printings from the sorted list", () => {
    const first = stubPrinting({ printingId: "p1" });
    const second = stubPrinting({ printingId: "p2" });
    render(
      <PromoPrintingsSection
        sectionId="s"
        title="Prerelease"
        printings={[first, second]}
        {...sectionProps({ sortPrintings: (printings) => printings.slice(0, 1) })}
      />,
    );

    expect(screen.getByText("(1)")).toBeInTheDocument();
    expect(screen.getAllByTestId("thumbnail")).toHaveLength(1);
  });

  it("renders parent anchors and the description only when given", () => {
    const printing = stubPrinting();
    const { container, rerender } = render(
      <PromoPrintingsSection
        sectionId="s"
        title="Prerelease"
        printings={[printing]}
        description="Handed out at Summoner Skirmish events."
        parentAnchorIds={["parent"]}
        {...sectionProps()}
      />,
    );

    expect(screen.getByText("Handed out at Summoner Skirmish events.")).toBeInTheDocument();
    expect(container.querySelector("#parent")).not.toBeNull();

    rerender(
      <PromoPrintingsSection
        sectionId="s"
        title="Prerelease"
        printings={[printing]}
        {...sectionProps()}
      />,
    );

    expect(screen.queryByText("Handed out at Summoner Skirmish events.")).toBeNull();
    expect(container.querySelector("#parent")).toBeNull();
  });

  it("passes the channel column to the list view only when asked", () => {
    const printing = stubPrinting();
    const { rerender } = render(
      <PromoPrintingsSection
        sectionId="s"
        title="Prerelease"
        printings={[printing]}
        showChannel
        {...sectionProps({ viewMode: "table" })}
      />,
    );

    expect(screen.getByTestId("list")).toHaveTextContent("1 rows, channel true");

    rerender(
      <PromoPrintingsSection
        sectionId="s"
        title="Prerelease"
        printings={[printing]}
        {...sectionProps({ viewMode: "table" })}
      />,
    );

    expect(screen.getByTestId("list")).toHaveTextContent("1 rows, channel false");
  });
});
