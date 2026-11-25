// @vitest-environment jsdom
import { labelMapOf } from "@openrift/shared/enum-label";
import { EMPTY_PRICE_LOOKUP } from "@openrift/shared/price-lookup";
import { indexBySideKey } from "@openrift/shared/printing-side";
import type { StandardArtFallback } from "@openrift/shared/standard";
import type { Printing } from "@openrift/shared/types/catalog";
import { WellKnown } from "@openrift/shared/well-known";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render } from "@testing-library/react";
import type { PropsWithChildren, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { CardThumbnail } from "@/features/cards/components/card-thumbnail";
import type { CardThumbnailDisplay } from "@/features/cards/hooks/use-card-thumbnail-display";
import { OtherSideContext, otherSideLookup } from "@/features/cards/lib/other-side-context";
import { initKeys } from "@/lib/query-keys";
import { stubPrinting } from "@/test/factories";
import { stubInitResponse } from "@/test/init-fixtures";

vi.mock("@/hooks/use-viewer-legality", () => ({
  useViewerLegality: () => ({ windows: [] }),
  useGlobalLegality: () => ({ windows: [] }),
}));

// No router in these tests, so swap the "Suggest image" Link for a plain span.
const { preloadRoute } = vi.hoisted(() => ({ preloadRoute: vi.fn(async () => undefined) }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
  useRouter: () => ({ preloadRoute, options: { defaultPreloadDelay: 50 } }),
}));

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(initKeys.all, stubInitResponse());
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

const baseDisplay: CardThumbnailDisplay = {
  fancyFan: true,
  gridFoil: false,
  coarsePointer: false,
  domainColors: {},
  finishLabels: labelMapOf({}),
  sizeLabels: labelMapOf({}),
  rarityLabels: labelMapOf({}),
  prices: EMPTY_PRICE_LOOKUP,
  favoriteMarketplace: "cardtrader",
  compactFmt: String,
  getFallbackArt: () => null,
};

function makePrintingWithImage(slug: string): Printing {
  return stubPrinting({
    card: { slug },
    images: [{ imageId: `${slug}-image-id-aa` }],
  });
}

/** React synthesizes onMouseEnter from mouseover. */
function hoverTile(container: HTMLElement) {
  const tile = container.querySelector("[data-printing-id]");
  if (!tile) {
    throw new Error("thumbnail tile not found");
  }
  fireEvent.mouseOver(tile);
}

function transitionEnd(propertyName: string): Event {
  const event = new Event("transitionend", { bubbles: true });
  Object.defineProperty(event, "propertyName", { value: propertyName });
  return event;
}

/** A closed sibling layer is its bare black clipper: the face mounts inside it on hover. */
function queryStandin(container: HTMLElement) {
  const layers = [...container.querySelectorAll(".aspect-card.bg-black")];
  return layers.find((layer) => layer.childElementCount === 0) ?? null;
}

function queryFanCover(container: HTMLElement) {
  return container.querySelector(".pointer-events-none.absolute.inset-0.bg-black");
}

describe("CardThumbnail siblings", () => {
  it("mounts sibling thumbnails on first hover, not on mount", () => {
    const front = makePrintingWithImage("RB1-001");
    const sibling = makePrintingWithImage("RB1-001-foil");
    const { container } = render(
      <CardThumbnail
        printing={front}
        onClick={() => {}}
        showImages
        siblings={[front, sibling]}
        display={{ ...baseDisplay, coarsePointer: false }}
      />,
    );
    const closedSrcs = [...container.querySelectorAll("img")].map((img) => img.getAttribute("src"));
    expect(closedSrcs).toContain("/media/cards/RB1-001-image-id-aa-400w.webp");
    expect(closedSrcs).not.toContain("/media/cards/RB1-001-foil-image-id-aa-400w.webp");
    expect(queryStandin(container)).not.toBeNull();

    hoverTile(container);
    const srcs = [...container.querySelectorAll("img")].map((img) => img.getAttribute("src"));
    expect(srcs).toContain("/media/cards/RB1-001-foil-image-id-aa-400w.webp");
  });

  it("labels no fanned sibling with its code or variant", () => {
    const front = makePrintingWithImage("RB1-001");
    const sibling = stubPrinting({
      card: { slug: "RB1-001" },
      shortCode: "RB1-001F",
      finish: WellKnown.finish.FOIL,
      images: [{ imageId: "RB1-001-foil-image-id-aa" }],
    });
    const { container } = render(
      <CardThumbnail
        printing={front}
        onClick={() => {}}
        showImages
        siblings={[front, sibling]}
        display={{
          ...baseDisplay,
          coarsePointer: false,
          finishLabels: labelMapOf({ foil: "Foil" }),
        }}
      />,
    );

    hoverTile(container);
    expect(container.textContent).not.toContain("RB1-001F");
    expect(container.textContent).not.toContain("Foil");
  });

  it("selects a fanned sibling when it is clicked", () => {
    const front = makePrintingWithImage("RB1-001");
    const sibling = makePrintingWithImage("RB1-001-foil");
    const onSiblingClick = vi.fn();
    const { container } = render(
      <CardThumbnail
        printing={front}
        onClick={() => {}}
        onSiblingClick={onSiblingClick}
        showImages
        siblings={[front, sibling]}
        display={baseDisplay}
      />,
    );
    const layer = container.querySelector(".origin-bottom")?.parentElement;
    if (!layer) {
      throw new Error("sibling layer not found");
    }

    fireEvent.click(layer);

    expect(onSiblingClick).toHaveBeenCalledWith(sibling);
  });

  it("renders the image overlay and badge on the card image", () => {
    const front = makePrintingWithImage("RB1-001");
    const { getByText } = render(
      <CardThumbnail
        printing={front}
        onClick={() => {}}
        showImages
        imageOverlay={<span>frame</span>}
        imageBadge={<span>×3</span>}
        display={{ ...baseDisplay, coarsePointer: false }}
      />,
    );

    expect(getByText("frame")).toBeDefined();
    expect(getByText("×3")).toBeDefined();
  });

  it("tints the tile and rings the image when selected, with no layer outside the tile", () => {
    const { container } = render(
      <CardThumbnail
        printing={makePrintingWithImage("RB1-001")}
        onClick={() => {}}
        showImages
        selected
        display={baseDisplay}
      />,
    );

    expect(container.querySelector("[data-printing-id]")?.className).toContain("bg-primary/10");
    expect(container.querySelector(".ring-primary.ring-2")).not.toBeNull();
    expect(container.querySelector(".blur-sm")).toBeNull();
  });

  it("leaves an unselected tile untinted and unringed", () => {
    const { container } = render(
      <CardThumbnail
        printing={makePrintingWithImage("RB1-001")}
        onClick={() => {}}
        showImages
        display={baseDisplay}
      />,
    );

    expect(container.querySelector("[data-printing-id]")?.className).not.toContain("bg-primary/10");
    expect(container.querySelector(".ring-primary.ring-2")).toBeNull();
  });

  it("exposes a checked state as a checkbox when one is given", () => {
    const front = makePrintingWithImage("RB1-001");
    const { getByRole } = render(
      <CardThumbnail
        printing={front}
        onClick={() => {}}
        showImages
        checked
        display={{ ...baseDisplay, coarsePointer: false }}
      />,
    );

    expect(getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
  });

  it("counts the printings in the meta row on coarse-pointer devices", () => {
    const front = makePrintingWithImage("RB1-001");
    const siblings = [
      front,
      { ...makePrintingWithImage("RB1-001-a"), shortCode: "RB1-001a" },
      { ...makePrintingWithImage("RB1-001-b"), shortCode: "RB1-001b" },
    ];
    const { getByTitle } = render(
      <CardThumbnail
        printing={front}
        onClick={() => {}}
        showImages
        siblings={siblings}
        display={{ ...baseDisplay, coarsePointer: true }}
      />,
    );

    expect(getByTitle("3 printings").textContent).toContain("3");
  });

  it("counts a design printed in several languages once, like the card detail", () => {
    const front = makePrintingWithImage("RB1-001");
    const siblings = [
      front,
      { ...front, printingId: "zh", language: "ZH" },
      { ...front, printingId: "foil", finish: "foil" },
      { ...front, printingId: "foil-zh", finish: "foil", language: "ZH" },
    ];
    const { getByTitle } = render(
      <CardThumbnail
        printing={front}
        onClick={() => {}}
        showImages
        siblings={siblings}
        display={{ ...baseDisplay, coarsePointer: true }}
      />,
    );

    expect(getByTitle("2 printings").textContent).toContain("2");
  });

  it("shows no printing count for a card with one printing", () => {
    const front = makePrintingWithImage("RB1-001");
    const { container } = render(
      <CardThumbnail
        printing={front}
        onClick={() => {}}
        showImages
        siblings={[front]}
        display={baseDisplay}
      />,
    );

    expect(container.querySelector('[data-slot="count-pill"]')).toBeNull();
  });

  it("lets fanned siblings take clicks once the fan has finished opening", () => {
    const front = makePrintingWithImage("RB1-001");
    const sibling = makePrintingWithImage("RB1-001-foil");
    const { container } = render(
      <CardThumbnail
        printing={front}
        onClick={() => {}}
        showImages
        siblings={[front, sibling]}
        display={{ ...baseDisplay, coarsePointer: false }}
      />,
    );
    const rotating = container.querySelector(".origin-bottom") as HTMLElement;
    const layer = rotating.parentElement as HTMLElement;

    hoverTile(container);
    expect(layer).not.toHaveClass("pointer-events-auto");

    fireEvent(rotating, transitionEnd("opacity"));
    expect(layer).not.toHaveClass("pointer-events-auto");

    fireEvent(rotating, transitionEnd("rotate"));
    expect(layer).toHaveClass("pointer-events-auto");

    fireEvent.mouseOut(container.querySelector("[data-printing-id]") as HTMLElement);
    expect(layer).not.toHaveClass("pointer-events-auto");
  });

  it("keeps fanned siblings inert when the closing transition ends", () => {
    const front = makePrintingWithImage("RB1-001");
    const sibling = makePrintingWithImage("RB1-001-foil");
    const { container } = render(
      <CardThumbnail
        printing={front}
        onClick={() => {}}
        showImages
        siblings={[front, sibling]}
        display={{ ...baseDisplay, coarsePointer: false }}
      />,
    );
    const rotating = container.querySelector(".origin-bottom") as HTMLElement;

    hoverTile(container);
    fireEvent.mouseOut(container.querySelector("[data-printing-id]") as HTMLElement);
    fireEvent(rotating, transitionEnd("rotate"));

    expect(rotating.parentElement).not.toHaveClass("pointer-events-auto");
  });

  it("re-covers mounted sibling faces in black while the fan is closed", () => {
    const front = makePrintingWithImage("RB1-001");
    const sibling = makePrintingWithImage("RB1-001-foil");
    const { container } = render(
      <CardThumbnail
        printing={front}
        onClick={() => {}}
        showImages
        siblings={[front, sibling]}
        display={{ ...baseDisplay, coarsePointer: false }}
      />,
    );
    expect(queryFanCover(container)).toBeNull();

    hoverTile(container);
    const cover = queryFanCover(container);
    expect(cover).not.toBeNull();
    expect(cover?.getAttribute("style")).toContain("--fan");
  });

  it("shows at most five stacked edges while the fan is closed", () => {
    const front = makePrintingWithImage("RB1-001");
    const siblings = [
      front,
      ...Array.from({ length: 8 }, (_, i) => makePrintingWithImage(`RB1-001-v${i}`)),
    ];
    const { container } = render(
      <CardThumbnail
        printing={front}
        onClick={() => {}}
        showImages
        siblings={siblings}
        display={baseDisplay}
      />,
    );
    const layers = [...container.querySelectorAll(".origin-bottom")];
    expect(layers).toHaveLength(8);

    const styles = layers.map((layer) => layer.getAttribute("style") ?? "");
    const visibleWhenClosed = styles.filter((style) => !style.includes("opacity: var(--fan"));
    expect(visibleWhenClosed).toHaveLength(5);

    expect(styles.slice(-5).every((style) => !style.includes("opacity: var(--fan"))).toBe(true);
  });

  it("does not load sibling thumbnails on coarse-pointer devices", () => {
    const front = makePrintingWithImage("RB1-001");
    const sibling = makePrintingWithImage("RB1-001-foil");
    const { container } = render(
      <CardThumbnail
        printing={front}
        onClick={() => {}}
        showImages
        siblings={[front, sibling]}
        display={{ ...baseDisplay, coarsePointer: true }}
      />,
    );
    hoverTile(container);
    const srcs = [...container.querySelectorAll("img")].map((img) => img.getAttribute("src"));
    expect(srcs).toContain("/media/cards/RB1-001-image-id-aa-400w.webp");
    expect(srcs).not.toContain("/media/cards/RB1-001-foil-image-id-aa-400w.webp");
  });

  it("renders placeholder art (not a bare gray box) for imageless siblings on hover", () => {
    const front = makePrintingWithImage("RB1-001");
    const sibling = stubPrinting({ card: { slug: "RB1-001" }, images: [] });
    const { container } = render(
      <CardThumbnail
        printing={front}
        onClick={() => {}}
        showImages
        siblings={[front, sibling]}
        display={{ ...baseDisplay, coarsePointer: false }}
      />,
      { wrapper: makeWrapper() },
    );
    expect(container.querySelector('[role="img"]')).toBeNull();
    expect(queryStandin(container)).not.toBeNull();

    hoverTile(container);
    const placeholder = container.querySelector('[role="img"]');
    expect(placeholder).not.toBeNull();
    expect(placeholder?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(queryStandin(container)).toBeNull();
  });

  it("keeps the cheap stand-in stack for imageless siblings on coarse-pointer devices", () => {
    const front = makePrintingWithImage("RB1-001");
    const sibling = stubPrinting({ card: { slug: "RB1-001" }, images: [] });
    const { container } = render(
      <CardThumbnail
        printing={front}
        onClick={() => {}}
        showImages
        siblings={[front, sibling]}
        display={{ ...baseDisplay, coarsePointer: true }}
      />,
    );
    hoverTile(container);
    expect(container.querySelector('[role="img"]')).toBeNull();
    expect(queryStandin(container)).not.toBeNull();
  });
});

describe("CardThumbnail image error fallback", () => {
  it("swaps the front image for placeholder art when it fails to load", () => {
    const printing = makePrintingWithImage("RB1-020");
    const { container } = render(
      <CardThumbnail printing={printing} onClick={() => {}} showImages display={baseDisplay} />,
      { wrapper: makeWrapper() },
    );
    expect(container.querySelector('[role="img"]')).toBeNull();

    const img = container.querySelector('img[src*="RB1-020"]');
    if (!img) {
      throw new Error("front image not found");
    }
    fireEvent.error(img);
    expect(container.querySelector('[role="img"]')).not.toBeNull();
    expect(container.querySelector('img[src*="RB1-020"]')).toBeNull();
  });

  it("swaps a fanned sibling's image for its placeholder when it fails to load", () => {
    const front = makePrintingWithImage("RB1-001");
    const sibling = makePrintingWithImage("RB1-001-foil");
    const { container } = render(
      <CardThumbnail
        printing={front}
        onClick={() => {}}
        showImages
        siblings={[front, sibling]}
        display={{ ...baseDisplay, coarsePointer: false }}
      />,
      { wrapper: makeWrapper() },
    );
    hoverTile(container);

    const siblingImg = container.querySelector('img[src*="RB1-001-foil"]');
    if (!siblingImg) {
      throw new Error("sibling image not found");
    }
    fireEvent.error(siblingImg);
    const placeholder = container.querySelector('[role="img"]');
    expect(placeholder).not.toBeNull();
    expect(placeholder?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(container.querySelector('img[src*="RB1-001-image"]')).not.toBeNull();
  });
});

describe("CardThumbnail standard-art fallback", () => {
  function fallbackTo(imageId: string, language: string): StandardArtFallback {
    const image = { face: "front" as const, imageId };
    const printing = stubPrinting({ language, images: [image] });
    return { printing, image };
  }
  it("shows the fallback art with the centered notice and no language badge for a same-language borrow", () => {
    const printing = stubPrinting({ card: { slug: "RB1-040" }, images: [] });
    const { container } = render(
      <CardThumbnail
        printing={printing}
        onClick={() => {}}
        showImages
        display={{ ...baseDisplay, getFallbackArt: () => fallbackTo("fallback-image-id", "EN") }}
      />,
      { wrapper: makeWrapper() },
    );
    expect(container.querySelector('img[src*="fallback-image-id"]')).not.toBeNull();
    expect(container.querySelector('[role="img"]')).toBeNull();
    expect(container.textContent).toContain("Placeholder");
    expect(container.textContent).toContain("(suggest image)");
    expect(container.textContent).not.toContain("EN");
  });

  it("adds a language badge when the borrowed art crossed languages", () => {
    const printing = stubPrinting({ card: { slug: "RB1-045" }, images: [], language: "SC" });
    const { container } = render(
      <CardThumbnail
        printing={printing}
        onClick={() => {}}
        showImages
        display={{ ...baseDisplay, getFallbackArt: () => fallbackTo("fallback-image-id", "EN") }}
      />,
      { wrapper: makeWrapper() },
    );
    expect(container.textContent).toContain("EN");
  });

  it("adds a badge per property the shown art doesn't depict (markers, signed)", () => {
    const printing = stubPrinting({
      card: { slug: "RB1-046" },
      images: [],
      markers: [{ id: "m1", slug: "promo", label: "Promo", description: null }],
      isSigned: true,
    });
    const { container } = render(
      <CardThumbnail
        printing={printing}
        onClick={() => {}}
        showImages
        display={{ ...baseDisplay, getFallbackArt: () => fallbackTo("fallback-image-id", "EN") }}
      />,
      { wrapper: makeWrapper() },
    );
    expect(container.textContent).toContain("Promo");
    expect(container.textContent).toContain("Signed");
  });

  it("borrows standard art for an imageless sibling when the fan opens", () => {
    const front = makePrintingWithImage("RB1-050");
    const sibling = stubPrinting({ card: { slug: "RB1-050" }, images: [] });
    const { container } = render(
      <CardThumbnail
        printing={front}
        onClick={() => {}}
        showImages
        siblings={[front, sibling]}
        display={{
          ...baseDisplay,
          coarsePointer: false,
          getFallbackArt: () => fallbackTo("fan-fallback-image-id", "EN"),
        }}
      />,
      { wrapper: makeWrapper() },
    );
    hoverTile(container);
    expect(container.querySelector('img[src*="fan-fallback-image-id"]')).not.toBeNull();
    expect(container.querySelector('[role="img"]')).toBeNull();
  });

  it("advances a fanned sibling from a failed image to the borrowed art", () => {
    const front = makePrintingWithImage("RB1-051");
    const sibling = makePrintingWithImage("RB1-051-foil");
    const { container } = render(
      <CardThumbnail
        printing={front}
        onClick={() => {}}
        showImages
        siblings={[front, sibling]}
        display={{
          ...baseDisplay,
          coarsePointer: false,
          getFallbackArt: () => fallbackTo("fan-fallback-image-id", "EN"),
        }}
      />,
      { wrapper: makeWrapper() },
    );
    hoverTile(container);
    const siblingImg = container.querySelector('img[src*="RB1-051-foil"]');
    if (!siblingImg) {
      throw new Error("sibling image not found");
    }
    fireEvent.error(siblingImg);
    expect(container.querySelector('img[src*="fan-fallback-image-id"]')).not.toBeNull();
    expect(container.querySelector('[role="img"]')).toBeNull();
  });

  it("keeps the drawn placeholder (with the notice) when no fallback art resolves", () => {
    const printing = stubPrinting({ card: { slug: "RB1-041" }, images: [] });
    const { container } = render(
      <CardThumbnail printing={printing} onClick={() => {}} showImages display={baseDisplay} />,
      { wrapper: makeWrapper() },
    );
    expect(container.querySelector('[role="img"]')).not.toBeNull();
    expect(container.textContent).toContain("(suggest image)");
  });

  it("keeps the notice outside the dimmed image layer on unowned cards", () => {
    const printing = stubPrinting({ card: { slug: "RB1-047" }, images: [] });
    const { container } = render(
      <CardThumbnail
        printing={printing}
        onClick={() => {}}
        showImages
        dimmed
        display={{ ...baseDisplay, getFallbackArt: () => fallbackTo("fallback-image-id", "EN") }}
      />,
      { wrapper: makeWrapper() },
    );
    const notice = container.querySelector('a, [class*="pointer-events-auto"]');
    expect(notice).not.toBeNull();
    expect(notice?.closest(".opacity-50")).toBeNull();
  });

  it("advances from a failed printing image to the fallback art", () => {
    const printing = makePrintingWithImage("RB1-042");
    const { container } = render(
      <CardThumbnail
        printing={printing}
        onClick={() => {}}
        showImages
        display={{ ...baseDisplay, getFallbackArt: () => fallbackTo("fallback-image-id", "EN") }}
      />,
      { wrapper: makeWrapper() },
    );
    const img = container.querySelector('img[src*="RB1-042"]');
    if (!img) {
      throw new Error("front image not found");
    }
    fireEvent.error(img);
    expect(container.querySelector('img[src*="fallback-image-id"]')).not.toBeNull();
    expect(container.querySelector('[role="img"]')).toBeNull();
  });

  it("falls back to placeholder art when the fallback image also fails to load", () => {
    const printing = stubPrinting({ card: { slug: "RB1-043" }, images: [] });
    const { container } = render(
      <CardThumbnail
        printing={printing}
        onClick={() => {}}
        showImages
        display={{ ...baseDisplay, getFallbackArt: () => fallbackTo("fallback-image-id", "EN") }}
      />,
      { wrapper: makeWrapper() },
    );
    const img = container.querySelector('img[src*="fallback-image-id"]');
    if (!img) {
      throw new Error("fallback image not found");
    }
    fireEvent.error(img);
    expect(container.querySelector('[role="img"]')).not.toBeNull();
    expect(container.querySelector('img[src*="fallback-image-id"]')).toBeNull();
  });

  it("does not resolve fallback art when images are hidden", () => {
    const printing = stubPrinting({ card: { slug: "RB1-044" }, images: [] });
    const getFallbackArt = vi.fn(() => fallbackTo("fallback-image-id", "EN"));
    const { container } = render(
      <CardThumbnail
        printing={printing}
        onClick={() => {}}
        showImages={false}
        display={{ ...baseDisplay, getFallbackArt }}
      />,
      { wrapper: makeWrapper() },
    );
    expect(getFallbackArt).not.toHaveBeenCalled();
    expect(container.querySelector('[role="img"]')).not.toBeNull();
  });
});

describe("CardThumbnail placeholder promo label", () => {
  const promoMarker = { id: "m1", slug: "promo", label: "Promo", description: null };
  const judgeMarker = { id: "m2", slug: "judge", label: "Judge", description: null };

  it("shows the promo marker's label on placeholder art", () => {
    const printing = stubPrinting({
      card: { slug: "RB1-010", name: "Stamped Scout" },
      images: [],
      markers: [promoMarker],
    });
    const { container } = render(
      <CardThumbnail printing={printing} onClick={() => {}} showImages display={baseDisplay} />,
      { wrapper: makeWrapper() },
    );
    expect(container.textContent).toContain("Promo");
  });

  it("does not surface other marker labels on placeholder art", () => {
    const printing = stubPrinting({
      card: { slug: "RB1-011", name: "Stamped Scout" },
      images: [],
      markers: [judgeMarker],
    });
    const { container } = render(
      <CardThumbnail printing={printing} onClick={() => {}} showImages display={baseDisplay} />,
      { wrapper: makeWrapper() },
    );
    expect(container.textContent).not.toContain("Judge");
  });
});

describe("CardThumbnail label", () => {
  it("names a Legend by its champion even when the printing carries a printed name", () => {
    const printing = stubPrinting({
      card: {
        slug: "SFD-197",
        name: "Emperor of the Sands",
        types: [WellKnown.cardType.LEGEND],
        tags: ["Azir"],
      },
      printedName: "Emperor of the Sands",
      images: [{ imageId: "SFD-197-image-id-aa" }],
    });
    const { container, getByAltText } = render(
      <CardThumbnail printing={printing} onClick={() => {}} showImages display={baseDisplay} />,
      { wrapper: makeWrapper() },
    );
    expect(container.textContent).toContain("Azir, Emperor of the Sands");
    expect(getByAltText("Azir, Emperor of the Sands")).not.toBeNull();
  });

  it("names both sides of a double-sided printing outside the cards view", () => {
    const printing = stubPrinting({
      shortCode: "OGN",
      card: { name: "Buff" },
      otherSide: {
        faceId: "face-recruit",
        cardId: "recruit",
        cardName: "Recruit",
        cardSlug: "recruit",
        shortCode: "OGN-271",
      },
    });
    const { container, rerender } = render(
      <CardThumbnail
        printing={printing}
        onClick={() => {}}
        showImages={false}
        display={baseDisplay}
        view="printings"
      />,
      { wrapper: makeWrapper() },
    );
    expect(container.textContent).toContain("OGN // OGN-271");
    expect(container.textContent).toContain("Buff // Recruit");

    rerender(
      <CardThumbnail
        printing={printing}
        onClick={() => {}}
        showImages={false}
        display={baseDisplay}
        view="cards"
      />,
    );
    expect(container.textContent).not.toContain("Recruit");
  });

  it("names the two sides in display order on a side-2 tile", () => {
    const printing = stubPrinting({
      side: 2,
      shortCode: "OGN",
      card: { name: "Buff" },
      otherSide: {
        faceId: "face-recruit",
        cardId: "recruit",
        cardName: "Recruit",
        cardSlug: "recruit",
        shortCode: "OGN-271",
      },
    });
    const { container } = render(
      <CardThumbnail
        printing={printing}
        onClick={() => {}}
        showImages={false}
        display={baseDisplay}
        view="printings"
      />,
      { wrapper: makeWrapper() },
    );
    expect(container.textContent).toContain("OGN-271 // OGN");
    expect(container.textContent).toContain("Recruit // Buff");
  });

  it("names the other side by its printed name on a localized printing", () => {
    const printing = stubPrinting({
      shortCode: "SGN-T02",
      language: "DE",
      printedName: "Vogel",
      card: { name: "Bird" },
      otherSide: {
        faceId: "face-sprite",
        cardId: "sprite",
        cardName: "Sprite",
        printedName: "Geist",
        cardSlug: "sprite",
        shortCode: "SGN-T08",
      },
    });
    const { container } = render(
      <CardThumbnail
        printing={printing}
        onClick={() => {}}
        showImages={false}
        display={baseDisplay}
        view="printings"
      />,
      { wrapper: makeWrapper() },
    );
    expect(container.textContent).toContain("Vogel // Geist");
  });
});

describe("CardThumbnail other side inset", () => {
  const pair = stubPrinting({
    shortCode: "SGN-T02",
    card: { name: "Bird" },
    images: [{ imageId: "bird-image" }],
    otherSide: {
      faceId: "face-sprite",
      cardId: "sprite",
      cardName: "Sprite",
      cardSlug: "sprite",
      shortCode: "SGN-T08",
      imageId: "sprite-image",
      finish: "foil",
    },
  });

  function renderPair(view: "cards" | "printings", showImages = true) {
    return render(
      <CardThumbnail
        printing={pair}
        onClick={() => {}}
        showImages={showImages}
        display={baseDisplay}
        view={view}
      />,
      { wrapper: makeWrapper() },
    );
  }

  function insetImage(container: HTMLElement) {
    return container.querySelector('img[src*="sprite-image"]');
  }

  it("shows the other side in the corner outside the cards view", () => {
    const { container } = renderPair("printings");
    expect(insetImage(container)).not.toBeNull();
  });

  it("leaves the cards view tile to its own card, with a double-sided hint", () => {
    const { container, getByRole } = renderPair("cards");
    expect(insetImage(container)).toBeNull();
    expect(getByRole("button", { name: /Double-sided/u })).toBeInTheDocument();
  });

  it("names the card once when it is printed on both sides", async () => {
    const buffBuff = stubPrinting({
      cardId: "buff",
      card: { name: "Buff" },
      otherSide: {
        faceId: "face-buff-2",
        cardId: "buff",
        cardName: "Buff",
        cardSlug: "buff",
        shortCode: "OGN-T02",
      },
    });
    const { getByRole, findByText } = render(
      <CardThumbnail
        printing={buffBuff}
        onClick={() => {}}
        showImages={false}
        display={baseDisplay}
        view="cards"
      />,
      { wrapper: makeWrapper() },
    );
    fireEvent.focus(getByRole("button", { name: /Double-sided/u }));
    expect(await findByText("Buff on both sides")).toBeInTheDocument();
  });

  it("fades the inset with an unowned tile", () => {
    const { container } = render(
      <CardThumbnail
        printing={pair}
        onClick={() => {}}
        showImages
        display={baseDisplay}
        view="printings"
        dimmed
      />,
      { wrapper: makeWrapper() },
    );
    expect(insetImage(container)?.closest(".opacity-50")).not.toBeNull();
  });

  it("draws no inset where the tile stands for a card, such as a deck list", () => {
    const { container } = render(
      <CardThumbnail printing={pair} onClick={() => {}} showImages display={baseDisplay} />,
      { wrapper: makeWrapper() },
    );
    expect(insetImage(container)).toBeNull();
  });

  it("draws no inset when images are hidden", () => {
    const { container } = renderPair("printings", false);
    expect(insetImage(container)).toBeNull();
  });
});

describe("CardThumbnail flip", () => {
  const bird = stubPrinting({
    printingId: "pair",
    side: 1,
    cardId: "bird",
    shortCode: "SGN-T02",
    card: { name: "Bird" },
    images: [{ imageId: "bird-image" }],
    otherSide: {
      faceId: "face-sprite",
      cardId: "sprite",
      cardName: "Sprite",
      cardSlug: "sprite",
      shortCode: "SGN-T08",
      imageId: "sprite-image",
    },
  });
  const sprite = stubPrinting({
    printingId: "pair",
    side: 2,
    cardId: "sprite",
    shortCode: "SGN-T08",
    card: { name: "Sprite" },
    images: [{ imageId: "sprite-image" }],
    otherSide: {
      faceId: "face-bird",
      cardId: "bird",
      cardName: "Bird",
      cardSlug: "bird",
      shortCode: "SGN-T02",
      imageId: "bird-image",
    },
  });
  const lookup = otherSideLookup(indexBySideKey([bird, sprite]));

  function flipWrapper() {
    const Base = makeWrapper();
    function Wrapper({ children }: PropsWithChildren) {
      return (
        <Base>
          <OtherSideContext value={lookup}>{children}</OtherSideContext>
        </Base>
      );
    }
    return Wrapper;
  }

  it("turns the tile to the other side and opens that side on click", () => {
    const onClick = vi.fn();
    const { getByRole, container } = render(
      <CardThumbnail
        printing={bird}
        onClick={onClick}
        showImages
        display={baseDisplay}
        view="printings"
      />,
      { wrapper: flipWrapper() },
    );

    fireEvent.click(getByRole("button", { name: "Flip to Sprite" }));

    expect(getByRole("button", { name: "Flip to Bird" })).toBeInTheDocument();
    expect(container.textContent).toContain("Sprite");
    fireEvent.click(getByRole("img", { name: "Sprite" }));
    expect(onClick).toHaveBeenCalledWith(sprite, expect.anything());

    fireEvent.click(getByRole("button", { name: "Flip to Bird" }));
    expect(getByRole("button", { name: "Flip to Sprite" })).toBeInTheDocument();
  });

  it("keeps the inset still outside a grid that offers flipping", () => {
    const { queryByRole } = render(
      <CardThumbnail
        printing={bird}
        onClick={() => {}}
        showImages
        display={baseDisplay}
        view="printings"
      />,
      { wrapper: makeWrapper() },
    );
    expect(queryByRole("button", { name: "Flip to Sprite" })).toBeNull();
  });

  it("keeps the inset still while copies are being selected", () => {
    const { queryByRole } = render(
      <CardThumbnail
        printing={bird}
        onClick={() => {}}
        showImages
        display={baseDisplay}
        view="printings"
        checked={false}
      />,
      { wrapper: flipWrapper() },
    );
    expect(queryByRole("button", { name: "Flip to Sprite" })).toBeNull();
  });
});

describe("CardThumbnail localized label", () => {
  it("keeps a localized Legend's printed name", () => {
    const printing = stubPrinting({
      card: {
        slug: "SFD-197",
        name: "Emperor of the Sands",
        types: [WellKnown.cardType.LEGEND],
        tags: ["Azir"],
      },
      printedName: "沙漠皇帝",
      images: [{ imageId: "SFD-197-image-id-aa" }],
    });
    const { container } = render(
      <CardThumbnail printing={printing} onClick={() => {}} showImages display={baseDisplay} />,
      { wrapper: makeWrapper() },
    );
    expect(container.textContent).toContain("沙漠皇帝");
    expect(container.textContent).not.toContain("Azir");
  });
});

describe("CardThumbnail price", () => {
  const pricedDisplay: CardThumbnailDisplay = {
    ...baseDisplay,
    prices: { get: () => 12.5, has: () => true },
    compactFmt: (value) => `${value} €`,
  };

  function queryMarketplaceIcon(container: HTMLElement) {
    return container.querySelector<HTMLImageElement>('img[src*="/images/external/"]');
  }

  it("shows the favorite marketplace icon in front of the price", () => {
    const printing = makePrintingWithImage("RB1-004");
    const { container } = render(
      <CardThumbnail printing={printing} onClick={() => {}} showImages display={pricedDisplay} />,
      { wrapper: makeWrapper() },
    );
    const icon = queryMarketplaceIcon(container);
    expect(icon?.src).toContain("cardtrader");
    expect(icon?.nextSibling?.textContent).toBe("12.5 €");
  });

  it("omits the icon when the printing has no price", () => {
    const printing = makePrintingWithImage("RB1-005");
    const { container } = render(
      <CardThumbnail printing={printing} onClick={() => {}} showImages display={baseDisplay} />,
      { wrapper: makeWrapper() },
    );
    expect(queryMarketplaceIcon(container)).toBeNull();
  });
});

describe("CardThumbnail image shell", () => {
  it("never applies a 3D transform, so the card's text stays crisp", () => {
    const printing = makePrintingWithImage("RB1-003");
    const { container } = render(
      <CardThumbnail
        printing={printing}
        onClick={() => {}}
        showImages
        display={{ ...baseDisplay, coarsePointer: false }}
      />,
    );
    const transforms = [...container.querySelectorAll<HTMLElement>("*")].map(
      (el) => `${el.style.transform} ${el.style.transformStyle} ${el.className}`,
    );
    expect(transforms.some((value) => /perspective|preserve-3d/u.test(value))).toBe(false);
  });
});

describe("CardThumbnail ban ribbons", () => {
  const ban = {
    formatId: WellKnown.banFormat.CONSTRUCTED,
    formatName: "Standard",
    bannedAt: "2026-09-18",
    reason: null,
  };

  function renderThumbnail(printing: Printing) {
    return render(<CardThumbnail printing={printing} onClick={() => {}} display={baseDisplay} />, {
      wrapper: makeWrapper(),
    });
  }

  it("labels a card with only a scheduled ban as ban incoming", () => {
    const { getByTitle } = renderThumbnail(stubPrinting({ card: { upcomingBans: [ban] } }));
    expect(getByTitle("Banned in Standard from 2026-09-18").textContent).toBe("Ban incoming");
  });

  it("shows only the banned ribbon when another ban is already in effect", () => {
    const printing = stubPrinting({
      card: { bans: [{ ...ban, bannedAt: "2026-03-31" }], upcomingBans: [ban] },
    });
    const { container } = renderThumbnail(printing);
    expect(container.textContent).toContain("Banned");
    expect(container.textContent).not.toContain("Ban incoming");
  });

  it("keeps the preview ribbon on an unreleased printing with a scheduled ban", () => {
    const printing = stubPrinting({ setReleased: false, card: { upcomingBans: [ban] } });
    const { container } = renderThumbnail(printing);
    expect(container.textContent).toContain("Preview");
    expect(container.textContent).not.toContain("Ban incoming");
  });
});

describe("CardThumbnail card page link", () => {
  const href = "/cards/annie-fiery?printingId=printing-1";

  function renderLinked() {
    const onClick = vi.fn();
    const utils = render(
      <CardThumbnail
        printing={makePrintingWithImage("annie-fiery")}
        onClick={onClick}
        showImages
        display={baseDisplay}
        href={href}
      />,
      { wrapper: makeWrapper() },
    );
    return { onClick, link: utils.getByRole("link") };
  }

  it("renders the image as a link to the card page", () => {
    const { link } = renderLinked();
    expect(link.getAttribute("href")).toBe(href);
  });

  it("runs onClick and prevents navigation on a plain click", () => {
    const { link, onClick } = renderLinked();
    const notPrevented = fireEvent.click(link);
    expect(notPrevented).toBe(false);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["ctrl", { ctrlKey: true }],
    ["meta", { metaKey: true }],
    ["shift", { shiftKey: true }],
    ["middle", { button: 1 }],
  ])("leaves a %s click to the browser", (_label, init) => {
    const { link, onClick } = renderLinked();
    let preventedByApp: boolean | undefined;
    /** Runs after React's root listener; the preventDefault only stops jsdom's unimplemented navigation. */
    const record = (event: Event) => {
      preventedByApp = event.defaultPrevented;
      event.preventDefault();
    };
    globalThis.addEventListener("click", record);
    fireEvent.click(link, init);
    globalThis.removeEventListener("click", record);
    expect(preventedByApp).toBe(false);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("opens the detail on Space", () => {
    const { link, onClick } = renderLinked();
    const notPrevented = fireEvent.keyDown(link, { key: " " });
    expect(notPrevented).toBe(false);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("preloads the card page after hovering past the preload delay", () => {
    vi.useFakeTimers();
    preloadRoute.mockClear();
    const { link } = renderLinked();
    fireEvent.mouseEnter(link);
    vi.advanceTimersByTime(50);
    vi.useRealTimers();
    expect(preloadRoute).toHaveBeenCalledWith({ to: ".", href });
  });

  it("skips the preload when the pointer leaves before the delay", () => {
    vi.useFakeTimers();
    preloadRoute.mockClear();
    const { link } = renderLinked();
    fireEvent.mouseEnter(link);
    fireEvent.mouseLeave(link);
    vi.advanceTimersByTime(50);
    vi.useRealTimers();
    expect(preloadRoute).not.toHaveBeenCalled();
  });

  it("keeps the image a button without an href", () => {
    const { queryByRole, getByRole } = render(
      <CardThumbnail
        printing={makePrintingWithImage("annie-fiery")}
        onClick={() => {}}
        showImages
        display={baseDisplay}
      />,
      { wrapper: makeWrapper() },
    );
    expect(queryByRole("link")).toBeNull();
    expect(getByRole("button")).toBeInTheDocument();
  });
});

describe("CardThumbnail drag tile", () => {
  function renderTile(dragBlockedLabel?: string) {
    return render(
      <CardThumbnail
        printing={stubPrinting()}
        onClick={() => {}}
        display={baseDisplay}
        dragData={{ type: "browser-card" }}
        dragId="tile-1"
        dragBlockedLabel={dragBlockedLabel}
        aboveCard={<button type="button">Add to deck</button>}
      />,
      { wrapper: makeWrapper() },
    );
  }

  it("names a tile the deck has no room for as a group around the card", () => {
    const { getByRole } = renderTile("Fury Rune, no room in this zone");
    const tile = getByRole("group", { name: "Fury Rune, no room in this zone" });
    expect(tile).toContainElement(getByRole("button", { name: "Add to deck" }));
  });

  it("adds no role, tab stop or drag description to an addable tile", () => {
    const { container, queryByRole } = renderTile();
    const tile = container.querySelector("[data-printing-id]");
    expect(queryByRole("group")).toBeNull();
    expect(tile).not.toHaveAttribute("role");
    expect(tile).not.toHaveAttribute("tabindex");
    expect(tile).not.toHaveAttribute("aria-roledescription");
  });
});

describe("CardThumbnail focus request", () => {
  function tile(focusRequested: boolean, onFocused: () => void) {
    return (
      <CardThumbnail
        printing={makePrintingWithImage("annie-fiery")}
        onClick={() => {}}
        showImages
        display={baseDisplay}
        focusRequested={focusRequested}
        onFocused={onFocused}
      />
    );
  }

  it("focuses the card once when asked and reports it", () => {
    const onFocused = vi.fn();
    const { getByRole, rerender } = render(tile(false, onFocused), { wrapper: makeWrapper() });
    expect(onFocused).not.toHaveBeenCalled();

    rerender(tile(true, onFocused));
    expect(getByRole("button")).toHaveFocus();

    rerender(tile(true, onFocused));
    expect(onFocused).toHaveBeenCalledOnce();
  });

  it("focuses a card that mounts with the request", () => {
    const onFocused = vi.fn();
    const { getByRole } = render(tile(true, onFocused), { wrapper: makeWrapper() });

    expect(getByRole("button")).toHaveFocus();
    expect(onFocused).toHaveBeenCalledOnce();
  });
});
