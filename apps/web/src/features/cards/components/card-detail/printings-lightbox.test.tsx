import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";
import type * as ReactRouter from "@tanstack/react-router";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { groupPrintingDesigns } from "@/features/cards/lib/printing-designs";
import { usePrintingLightboxStore } from "@/features/cards/stores/printing-lightbox-store";
import { stubPrinting } from "@/test/factories";

import { CardDetailDialogShell, CardDetailDrawerShell } from "./card-detail-shells";
import type * as PrintingStats from "./printing-stats";
import { PrintingsHostProvider, usePrintingsHostState } from "./printings-host";
import { lightboxKeyTarget, PrintingsLightbox } from "./printings-lightbox";

const routerStub = { navigate: vi.fn(), latestLocation: { href: "/cards" } };
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouter>()),
  useRouter: () => routerStub,
}));

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({
    labels: { artVariants: {}, finishes: { normal: "Normal", foil: "Foil" }, cardSizes: {} },
  }),
  useLanguageLabels: () => ({}),
  useLanguageColors: () => ({}),
}));

vi.mock("@/hooks/use-effective-language-order", () => ({
  useEffectiveLanguageOrder: () => ["EN"],
}));

vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({ printingsByCardId: new Map() }),
}));

vi.mock("./card-detail-art", () => ({
  CardDetailArt: ({ printing: shown }: { printing: Printing }) => (
    <img alt={shown.card.name} src={`/${shown.images[0]?.imageId ?? "none"}.webp`} />
  ),
}));

vi.mock("@/features/cards/components/card-page-printings", () => ({
  DesignDetails: () => null,
  PrintingLanguageMatrix: ({
    printings: shown,
    onSelect,
    onLanguageSelect,
    onDesignSelect,
  }: {
    printings: Printing[];
    onSelect: (printing: Printing) => void;
    onLanguageSelect?: (language: string) => void;
    onDesignSelect?: (designKey: string) => void;
  }) => {
    const { languages, designs } = groupPrintingDesigns(shown);
    return (
      <>
        {onLanguageSelect &&
          languages.map((code) => (
            <button key={code} type="button" onClick={() => onLanguageSelect(code)}>
              {`language ${code}`}
            </button>
          ))}
        {onDesignSelect &&
          designs.map((design) => (
            <button key={design.key} type="button" onClick={() => onDesignSelect(design.key)}>
              {`design ${design.lead.shortCode} ${design.lead.finish}`}
            </button>
          ))}
        <ul aria-label="Printing matrix">
          {shown.map((entry) => (
            <li key={entry.printingId}>
              <button type="button" data-lightbox-tile="" onClick={() => onSelect(entry)}>
                {`cell ${entry.language} ${entry.shortCode} ${entry.finish}`}
              </button>
            </li>
          ))}
        </ul>
      </>
    );
  },
}));

vi.mock("./printing-stats", async (importOriginal) => ({
  ...(await importOriginal<typeof PrintingStats>()),
  WithPrintingStats: ({ children }: { children: (stats: unknown) => ReactNode }) =>
    children({ owned: {}, price: () => "€1.00" }),
}));

vi.mock("@/features/cards/components/selection-detail-pane", () => ({
  CardDetailSkeleton: () => null,
}));

const viewport = vi.hoisted(() => ({ mobile: true }));
vi.mock("@/hooks/use-is-mobile", () => ({ useIsMobile: () => viewport.mobile }));

beforeEach(() => {
  viewport.mobile = true;
  routerStub.navigate.mockReset();
  usePrintingLightboxStore.setState({ requestedSideKey: null, pickedSideKey: null });
});

function printing(shortCode: string, imageId: string, overrides: Partial<Printing> = {}) {
  return stubPrinting({
    cardId: "ahri",
    card: { name: "Ahri, Inquisitive" },
    setId: "ogn",
    shortCode,
    publicCode: `${shortCode}/298`,
    language: "EN",
    images: [{ imageId }],
    ...overrides,
  });
}

const normal = printing("OGN-119", "img-a", { finish: "normal" });
const foil = printing("OGN-119", "img-a", { finish: "foil" });
const alt = printing("OGN-119a", "img-b", { artVariant: "altart" });

function renderLightbox(printings: Printing[], onSelect = vi.fn()) {
  render(
    <PrintingsLightbox printing={normal} printings={printings} showImages onSelect={onSelect} />,
  );
  return onSelect;
}

describe("PrintingsLightbox", () => {
  it("hides the button for a single printing", () => {
    renderLightbox([normal]);

    expect(screen.queryByRole("button", { name: /All printings/u })).toBeNull();
  });

  it("shows the button for one design printed in two languages", () => {
    const krNormal = printing("OGN-119", "img-kr", { finish: "normal", language: "KR" });
    renderLightbox([normal, krNormal]);

    expect(screen.getByRole("button", { name: "All printings" })).toBeTruthy();
  });

  it("shows the button for more than one printing", () => {
    renderLightbox([normal, foil, alt]);

    expect(screen.getByRole("button", { name: "All printings" })).toBeTruthy();
  });

  it("shows a tile for every printing, also when printings share an image", async () => {
    renderLightbox([normal, foil, alt]);

    await userEvent.click(screen.getByRole("button", { name: "All printings" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Ahri, Inquisitive");
    expect(dialog.textContent).toContain("3 printings");
    expect(dialog.querySelectorAll("[data-lightbox-tile]")).toHaveLength(3);
    expect(dialog.querySelectorAll('[data-lightbox-tile][aria-pressed="true"]')).toHaveLength(1);
  });

  it("opens on the table of every language and switches to tiles from a header language", async () => {
    const krNormal = printing("OGN-119", "img-kr", { finish: "normal", language: "KR" });
    renderLightbox([normal, foil, alt, krNormal]);

    await userEvent.click(screen.getByRole("button", { name: "All printings" }));
    const dialog = await screen.findByRole("dialog");
    expect(screen.getByRole("list", { name: "Printing matrix" })).toBeTruthy();
    expect(dialog.querySelectorAll("[data-lightbox-cell]")).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: "language KR" }));

    expect(dialog.querySelectorAll("[data-lightbox-tile]")).toHaveLength(1);
    expect(dialog.querySelector("img")?.getAttribute("src")).toBe("/img-kr.webp");
    expect(dialog.textContent).toContain("1 printing");

    await userEvent.click(screen.getByRole("button", { name: "Show overview" }));

    expect(screen.getByRole("list", { name: "Printing matrix" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show overview" })).toBeNull();
  });

  it("shows one design in every language as tiles from its row", async () => {
    const krNormal = printing("OGN-119", "img-kr", { finish: "normal", language: "KR" });
    renderLightbox([normal, foil, alt, krNormal]);

    await userEvent.click(screen.getByRole("button", { name: "All printings" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(screen.getByRole("button", { name: "design OGN-119 normal" }));

    const shown = [...dialog.querySelectorAll("img")].map((img) => img.getAttribute("src"));
    expect(shown).toEqual(["/img-a.webp", "/img-kr.webp"]);
    expect(screen.getByRole("button", { name: "Show overview" })).toBeTruthy();
  });

  it("shows the tiles straight away when every printing shares a language", async () => {
    renderLightbox([normal, foil, alt]);

    await userEvent.click(screen.getByRole("button", { name: "All printings" }));
    const dialog = await screen.findByRole("dialog");

    expect(screen.queryByRole("list", { name: "Printing matrix" })).toBeNull();
    expect(dialog.querySelectorAll("[data-lightbox-cell]")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Show overview" })).toBeNull();
  });

  it("opens on the table of every language on desktop", async () => {
    viewport.mobile = false;
    const krNormal = printing("OGN-119", "img-kr", { finish: "normal", language: "KR" });
    renderLightbox([normal, foil, alt, krNormal]);

    await userEvent.click(screen.getByRole("button", { name: "All printings" }));
    await screen.findByRole("dialog");

    const matrix = screen.getByRole("list", { name: "Printing matrix" });
    expect(within(matrix).getAllByRole("button")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: "Images" })).toBeNull();
  });

  it("keeps the table plain on desktop and selects from it", async () => {
    viewport.mobile = false;
    const krNormal = printing("OGN-119", "img-kr", { finish: "normal", language: "KR" });
    const onSelect = renderLightbox([normal, foil, alt, krNormal]);

    await userEvent.click(screen.getByRole("button", { name: "All printings" }));
    await screen.findByRole("dialog");

    expect(screen.queryByRole("button", { name: "language KR" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^design /u })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "cell KR OGN-119 normal" }));

    expect(onSelect).toHaveBeenCalledWith(krNormal);
  });

  it("selects the clicked tile's printing and closes", async () => {
    const onSelect = renderLightbox([normal, foil, alt]);

    await userEvent.click(screen.getByRole("button", { name: "All printings" }));
    await userEvent.click(await screen.findByRole("button", { name: /OGN-119a/u }));

    expect(onSelect).toHaveBeenCalledWith(alt);
    expect(usePrintingLightboxStore.getState().pickedSideKey).toBe(sideKey(alt));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on Escape without closing the dialog it opened from", async () => {
    const onOuterChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOuterChange}>
        <DialogContent>
          <DialogTitle>Card detail</DialogTitle>
          <PrintingsLightbox
            printing={normal}
            printings={[normal, foil, alt]}
            showImages
            onSelect={vi.fn()}
          />
        </DialogContent>
      </Dialog>,
    );

    await userEvent.click(screen.getByRole("button", { name: "All printings" }));
    expect(await screen.findByRole("dialog", { name: "Ahri, Inquisitive" })).toBeTruthy();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Ahri, Inquisitive" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Card detail" })).toBeTruthy();
    expect(onOuterChange).not.toHaveBeenCalled();
  });

  it("moves between tiles with the arrow keys without reaching window listeners", async () => {
    const onWindowKey = vi.fn();
    globalThis.addEventListener("keydown", onWindowKey);
    renderLightbox([normal, foil, alt]);

    await userEvent.click(screen.getByRole("button", { name: "All printings" }));
    const dialog = await screen.findByRole("dialog");
    const first = dialog.querySelector<HTMLElement>('[data-lightbox-tile][aria-pressed="true"]');
    if (!first) {
      throw new Error("no selected tile");
    }
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "OGN-119 · Foil" }));
    expect(onWindowKey).not.toHaveBeenCalled();
    globalThis.removeEventListener("keydown", onWindowKey);
  });

  it("moves between the desktop table's cells with the arrow keys", async () => {
    viewport.mobile = false;
    const krNormal = printing("OGN-119", "img-kr", { finish: "normal", language: "KR" });
    renderLightbox([normal, foil, alt, krNormal]);

    await userEvent.click(screen.getByRole("button", { name: "All printings" }));
    const first = await screen.findByRole("button", { name: "cell EN OGN-119 normal" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "cell EN OGN-119 foil" }),
    );
  });

  it("opens on a request for the shown printing and consumes it", async () => {
    usePrintingLightboxStore.getState().request(sideKey(normal));
    renderLightbox([normal, foil, alt]);

    expect(await screen.findByRole("dialog", { name: "Ahri, Inquisitive" })).toBeTruthy();
    expect(usePrintingLightboxStore.getState().requestedSideKey).toBeNull();
  });

  it("ignores a request for another printing", () => {
    usePrintingLightboxStore.getState().request(sideKey(alt));
    renderLightbox([normal, foil, alt]);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(usePrintingLightboxStore.getState().requestedSideKey).toBe(sideKey(alt));
  });
});

function Host({ children }: { children: ReactNode }) {
  const { expanded, host, slotRef } = usePrintingsHostState();
  return (
    <>
      <PrintingsHostProvider host={host}>{children}</PrintingsHostProvider>
      <div data-testid="slot" data-expanded={expanded} ref={slotRef} />
    </>
  );
}

function renderInHost(onOuterKey = vi.fn(), printings = [normal, foil, alt]) {
  const onSelect = vi.fn();
  render(
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- stands in for the host dialog's key handling
    <div onKeyDown={onOuterKey}>
      <Host>
        <PrintingsLightbox printing={normal} printings={printings} showImages onSelect={onSelect} />
      </Host>
    </div>,
  );
  return onSelect;
}

describe("PrintingsLightbox in a host surface", () => {
  it("grows the host and renders into its slot without a dialog", async () => {
    renderInHost();

    await userEvent.click(screen.getByRole("button", { name: "All printings" }));

    const slot = screen.getByTestId("slot");
    expect(slot).toHaveAttribute("data-expanded", "true");
    expect(within(slot).getByRole("region", { name: "Ahri, Inquisitive" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("selects the picked printing and shrinks the host", async () => {
    const onSelect = renderInHost();

    await userEvent.click(screen.getByRole("button", { name: "All printings" }));
    await userEvent.click(await screen.findByRole("button", { name: /OGN-119a/u }));

    expect(onSelect).toHaveBeenCalledWith(alt);
    expect(screen.getByTestId("slot")).toHaveAttribute("data-expanded", "false");
    expect(screen.queryByRole("region", { name: "Ahri, Inquisitive" })).toBeNull();
  });

  it("shrinks back on the back button without a pick", async () => {
    const onSelect = renderInHost();

    await userEvent.click(screen.getByRole("button", { name: "All printings" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByTestId("slot")).toHaveAttribute("data-expanded", "false");
  });

  it("shrinks back on Escape without the key reaching the host", async () => {
    const onOuterKey = vi.fn();
    renderInHost(onOuterKey);

    await userEvent.click(screen.getByRole("button", { name: "All printings" }));
    await userEvent.keyboard("{Escape}");

    expect(screen.getByTestId("slot")).toHaveAttribute("data-expanded", "false");
    expect(onOuterKey).not.toHaveBeenCalled();
  });

  it.each(["language KR", "design OGN-119 normal"])(
    "still shrinks on Escape after %s swaps the table for tiles",
    async (control) => {
      const onOuterKey = vi.fn();
      const krNormal = printing("OGN-119", "img-kr", { finish: "normal", language: "KR" });
      renderInHost(onOuterKey, [normal, foil, alt, krNormal]);

      await userEvent.click(screen.getByRole("button", { name: "All printings" }));
      await userEvent.click(screen.getByRole("button", { name: control }));
      await userEvent.click(screen.getByRole("button", { name: "Show overview" }));
      await userEvent.keyboard("{Escape}");

      expect(screen.getByTestId("slot")).toHaveAttribute("data-expanded", "false");
      expect(onOuterKey).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["the back button", () => userEvent.click(screen.getByRole("button", { name: "Back" }))],
    [
      "a pick",
      async () => userEvent.click(await screen.findByRole("button", { name: /OGN-119a/u })),
    ],
  ])("returns focus to the trigger after %s", async (_, shrink) => {
    renderInHost();

    await userEvent.click(screen.getByRole("button", { name: "All printings" }));
    await shrink();

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "All printings" }));
  });
});

describe.each([
  ["dialog", CardDetailDialogShell],
  ["drawer", CardDetailDrawerShell],
])("PrintingsLightbox in the card detail %s", (_, Shell) => {
  it("grows in place and shrinks on Escape without closing the shell", async () => {
    const onClose = vi.fn();
    render(
      <Shell onClose={onClose}>
        <PrintingsLightbox
          printing={normal}
          printings={[normal, foil, alt]}
          showImages
          onSelect={vi.fn()}
        />
      </Shell>,
    );

    await userEvent.click(screen.getByRole("button", { name: "All printings" }));

    expect(await screen.findByRole("region", { name: "Ahri, Inquisitive" })).toBeTruthy();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("region", { name: "Ahri, Inquisitive" })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("lightboxKeyTarget", () => {
  const tile = (offsetLeft: number, offsetTop: number) => ({
    offsetLeft,
    offsetTop,
    offsetWidth: 100,
  });
  const oneRow = [tile(0, 0), tile(100, 0), tile(200, 0)];
  const wrapped = [tile(0, 0), tile(100, 0), tile(200, 0), tile(50, 300), tile(150, 300)];

  it("steps one tile along a single row with every arrow key", () => {
    expect(lightboxKeyTarget("ArrowRight", oneRow, 0)).toBe(1);
    expect(lightboxKeyTarget("ArrowDown", oneRow, 1)).toBe(2);
    expect(lightboxKeyTarget("ArrowUp", oneRow, 1)).toBe(0);
  });

  it("stops at either end", () => {
    expect(lightboxKeyTarget("ArrowLeft", oneRow, 0)).toBe(0);
    expect(lightboxKeyTarget("ArrowRight", oneRow, 2)).toBe(2);
  });

  it("moves to the nearest tile in the next or previous row once the tiles wrap", () => {
    expect(lightboxKeyTarget("ArrowDown", wrapped, 2)).toBe(4);
    expect(lightboxKeyTarget("ArrowUp", wrapped, 3)).toBe(0);
  });

  it("stays put on ArrowDown in the last row of a wrapped grid", () => {
    expect(lightboxKeyTarget("ArrowDown", wrapped, 4)).toBe(4);
  });

  it("jumps to the ends with Home and End", () => {
    expect(lightboxKeyTarget("Home", wrapped, 3)).toBe(0);
    expect(lightboxKeyTarget("End", wrapped, 0)).toBe(4);
  });
});
