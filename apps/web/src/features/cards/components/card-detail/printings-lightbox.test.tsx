import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";
import type * as ReactRouter from "@tanstack/react-router";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { usePrintingLightboxStore } from "@/features/cards/stores/printing-lightbox-store";
import { stubPrinting } from "@/test/factories";

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
  PrintingLanguageMatrix: ({
    printings: shown,
    onSelect,
  }: {
    printings: Printing[];
    onSelect: (printing: Printing) => void;
  }) => (
    <ul aria-label="Printing matrix">
      {shown.map((entry) => (
        <li key={entry.printingId}>
          <button type="button" onClick={() => onSelect(entry)}>
            {`cell ${entry.language} ${entry.shortCode} ${entry.finish}`}
          </button>
        </li>
      ))}
    </ul>
  ),
}));

beforeEach(() => {
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

  it("opens in the shown printing's language and switches tiles with the language pills", async () => {
    const krNormal = printing("OGN-119", "img-kr", { finish: "normal", language: "KR" });
    renderLightbox([normal, foil, alt, krNormal]);

    await userEvent.click(screen.getByRole("button", { name: "All printings" }));
    const dialog = await screen.findByRole("dialog");
    const languages = screen.getByRole("group", { name: "Language" });
    expect(within(languages).getByRole("button", { name: "EN" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(dialog.querySelectorAll("[data-lightbox-tile]")).toHaveLength(3);

    await userEvent.click(within(languages).getByRole("button", { name: "KR" }));

    expect(dialog.querySelectorAll("[data-lightbox-tile]")).toHaveLength(1);
    expect(dialog.querySelector("img")?.getAttribute("src")).toBe("/img-kr.webp");
    expect(dialog.textContent).toContain("1 printing");
  });

  it("shows every language's printings with the All pill", async () => {
    const krNormal = printing("OGN-119", "img-kr", { finish: "normal", language: "KR" });
    renderLightbox([normal, foil, alt, krNormal]);

    await userEvent.click(screen.getByRole("button", { name: "All printings" }));
    const dialog = await screen.findByRole("dialog");
    const languages = screen.getByRole("group", { name: "Language" });
    await userEvent.click(within(languages).getByRole("button", { name: "All" }));

    expect(dialog.querySelectorAll("[data-lightbox-tile]")).toHaveLength(4);
    expect(within(languages).getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("hides the language pills when every printing shares a language", async () => {
    renderLightbox([normal, foil, alt]);

    await userEvent.click(screen.getByRole("button", { name: "All printings" }));
    await screen.findByRole("dialog");

    expect(screen.queryByRole("group", { name: "Language" })).toBeNull();
  });

  it("switches to the table of every language and selects from it", async () => {
    const krNormal = printing("OGN-119", "img-kr", { finish: "normal", language: "KR" });
    const onSelect = renderLightbox([normal, foil, alt, krNormal]);

    await userEvent.click(screen.getByRole("button", { name: "All printings" }));
    await screen.findByRole("dialog");
    await userEvent.click(screen.getByRole("button", { name: "Table" }));

    expect(screen.getByRole("list", { name: "Printing matrix" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Language" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "cell KR OGN-119 normal" }));

    expect(onSelect).toHaveBeenCalledWith(krNormal);
    expect(screen.queryByRole("dialog")).toBeNull();
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
