import type {
  AdminPrintingImageResponse,
  AdminPrintingResponse,
  CandidatePrintingResponse,
} from "@openrift/shared/types/api/admin";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DeduplicatedSourceImage } from "@/features/admin/components/card-detail-shared";
import { useAdminCardFoldStore } from "@/features/admin/stores/admin-card-fold-store";
import { createStoreResetter } from "@/test/store-helpers";

const captured = vi.hoisted(() => ({
  spreadsheet: null as {
    candidateRows?: unknown[];
    onCellClick?: (field: string, value: unknown, candidateId: string) => void;
  } | null,
  switcher: null as {
    images?: AdminPrintingImageResponse[];
    sourceImages?: DeduplicatedSourceImage[];
    siblingImages?: { imageFileId: string; printingLabel: string }[];
    derivedArtLabel?: string | null;
  } | null,
  checkAll: vi.fn(),
  checkSource: vi.fn(),
  deletePrinting: vi.fn(),
  acceptField: vi.fn(),
  toastSuccess: vi.fn(),
  sourceImageCells: [] as { url: string; isUsed: boolean }[],
}));

vi.mock("@/features/admin/components/candidate-spreadsheet", () => ({
  // The image tools and the sources' art live in the grid's cells, so the stub
  // must render both slots for them to mount.
  CandidateSpreadsheet: (props: {
    candidateRows?: { id: string }[];
    onCellClick?: (field: string, value: unknown, candidateId: string) => void;
    renderActiveCell?: (field: { key: string }) => ReactNode;
    renderCandidateCell?: (field: { key: string }, row: { id: string }) => ReactNode;
  }) => {
    captured.spreadsheet = props;
    return (
      <>
        {props.renderActiveCell?.({ key: "imageUrl" })}
        {(props.candidateRows ?? []).map((row) => (
          <div key={row.id}>{props.renderCandidateCell?.({ key: "imageUrl" }, row)}</div>
        ))}
      </>
    );
  },
}));

vi.mock("@/features/admin/components/printing-source-image-cell", () => ({
  PrintingSourceImageCell: (props: { url: string; isUsed: boolean }) => {
    captured.sourceImageCells.push({ url: props.url, isUsed: props.isUsed });
    return null;
  },
}));

vi.mock("@/features/admin/components/printing-image-switcher", () => ({
  PrintingImageSwitcher: (props: {
    images?: AdminPrintingImageResponse[];
    sourceImages?: DeduplicatedSourceImage[];
    siblingImages?: { imageFileId: string; printingLabel: string }[];
    derivedArtLabel?: string | null;
  }) => {
    captured.switcher = props;
    return null;
  },
}));

vi.mock("@/features/admin/components/printing-citations-editor", () => ({
  PrintingCitationsEditor: () => <div data-testid="citations-editor" />,
}));

// The real chip reads language colors from the /init suspense query.
vi.mock("@/components/language-chip", () => ({
  LanguageChip: ({ code }: { code: string }) => <span>{code}</span>,
}));

vi.mock("@tanstack/react-router", () => ({ Link: () => null }));

vi.mock("sonner", () => ({ toast: { success: captured.toastSuccess } }));

const stubMutation = { mutate: vi.fn(), isPending: false };
vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  useAcceptPrintingField: () => ({ mutate: captured.acceptField, isPending: false }),
  useCheckAllCandidatePrintings: () => ({ mutate: captured.checkAll, isPending: false }),
  useCheckCandidatePrinting: () => ({ mutate: captured.checkSource, isPending: false }),
  useCopyCandidatePrinting: () => stubMutation,
  useDeleteCandidatePrinting: () => stubMutation,
  useDeletePrinting: () => ({ mutate: captured.deletePrinting, isPending: false }),
  useLinkCandidatePrintings: () => stubMutation,
  useUncheckCandidatePrinting: () => stubMutation,
}));

vi.mock("@/features/admin/hooks/use-ignored-candidates", () => ({
  useIgnoreCandidatePrinting: () => stubMutation,
}));

vi.mock("@/features/admin/hooks/use-admin-printing-citations", () => ({
  useAdminPrintingCitations: () => ({ data: { citations: [] } }),
}));

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({ labels: { rarities: {}, finishes: {}, artVariants: {} } }),
}));

vi.mock("@/hooks/use-markers", () => ({
  useMarkers: () => ({ data: { markers: [] } }),
}));

// The real menu renders its items only while open.
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => null,
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { PrintingReviewCard } from "./printing-review-card";

const CARD_ID = "yasuo";

function stubPrinting(overrides: Partial<AdminPrintingResponse> = {}): AdminPrintingResponse {
  return {
    id: "p1",
    cardId: "card-1",
    expectedPrintingId: "OGN-001::foil",
    setSlug: "ogn",
    language: "EN",
    markerSlugs: [],
    rarity: "rare",
    artVariant: "normal",
    isSigned: false,
    finish: "foil",
    size: "standard",
    canonicalRank: 0,
    fallbackArtMode: "auto",
    fallbackImageFileId: null,
    ...overrides,
  } as AdminPrintingResponse;
}

function stubSource(overrides: Partial<CandidatePrintingResponse> = {}): CandidatePrintingResponse {
  return {
    id: "cp1",
    printingId: "p1",
    candidateCardId: "cc1",
    externalId: "x1",
    finish: "foil",
    imageUrl: null,
    checkedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  } as CandidatePrintingResponse;
}

function stubImage(
  overrides: Partial<AdminPrintingImageResponse> = {},
): AdminPrintingImageResponse {
  return {
    id: "img1",
    printingId: "p1",
    imageFileId: "file-1",
    face: "front",
    originalUrl: "https://cdn.test/a.png",
    rehostedUrl: null,
    isActive: true,
    ...overrides,
  } as AdminPrintingImageResponse;
}

function renderCard(
  props: Partial<React.ComponentProps<typeof PrintingReviewCard>> = {},
): ReturnType<typeof render> {
  const printing = props.printing ?? stubPrinting();
  return render(
    <PrintingReviewCard
      printing={printing}
      cardId={CARD_ID}
      printings={[printing]}
      candidatePrintings={[]}
      printingImages={[]}
      sourceLabels={{}}
      sourceNames={{}}
      sourceSubmitters={{}}
      providerSettings={[]}
      printingSourceFields={[]}
      setTotals={{}}
      costKeywords={[]}
      invalidates={[]}
      defaultExpanded
      isAdmin
      agreedFieldsFolded
      onAgreedFieldsFoldedChange={vi.fn()}
      {...props}
    />,
  );
}

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(useAdminCardFoldStore);
  captured.spreadsheet = null;
  captured.switcher = null;
  captured.checkAll.mockReset();
  captured.checkSource.mockReset();
  captured.deletePrinting.mockReset();
  captured.acceptField.mockReset();
  captured.toastSuccess.mockReset();
  captured.sourceImageCells = [];
});

afterEach(() => {
  resetStore();
});

describe("PrintingReviewCard", () => {
  it("shows the printing label in the collapsed row", () => {
    const { getByText } = renderCard({
      candidatePrintings: [stubSource({ id: "cp1" }), stubSource({ id: "cp2" })],
    });

    expect(getByText("OGN-001::foil")).toBeTruthy();
  });

  it("passes only its own sources and images down", () => {
    renderCard({
      candidatePrintings: [stubSource({ id: "cp1" }), stubSource({ id: "cp3", printingId: "p2" })],
      printingImages: [stubImage({ id: "img1" }), stubImage({ id: "img2", printingId: "p2" })],
    });

    expect(captured.spreadsheet?.candidateRows).toHaveLength(1);
    expect(captured.switcher?.images?.map((i) => i.id)).toEqual(["img1"]);
  });

  it("shows no badge when the printing has no active image and no substitute", () => {
    const { queryByText } = renderCard({ printingImages: [stubImage({ isActive: false })] });

    expect(queryByText("no image")).toBeNull();
    expect(queryByText("substitute image")).toBeNull();
  });

  it("marks a pinned substitute instead of warning", () => {
    const printing = stubPrinting({ fallbackArtMode: "pinned", fallbackImageFileId: "file-2" });
    const { getByText, queryByText } = renderCard({
      printing,
      printings: [printing],
      printingImages: [stubImage({ isActive: false })],
    });

    expect(getByText("substitute image")).toBeTruthy();
    expect(queryByText("no image")).toBeNull();
  });

  it("passes down the printing the derived substitute comes from", () => {
    const own = stubPrinting({ id: "p1", finish: "metal", canonicalRank: 5 });
    const standard = stubPrinting({
      id: "p2",
      expectedPrintingId: "OGN-001 · normal · EN",
      finish: "normal",
    });
    renderCard({
      printing: own,
      printings: [own, standard],
      printingImages: [
        stubImage({ id: "img2", printingId: "p2", rehostedUrl: "https://cdn.test/rehosted/b" }),
      ],
    });

    expect(captured.switcher?.derivedArtLabel).toBe("OGN-001 · normal · EN");
  });

  it("passes a null derived label when no standard printing carries art", () => {
    renderCard({ printingImages: [] });

    expect(captured.switcher?.derivedArtLabel).toBeNull();
  });

  it("draws a placeholder instead of a broken image when nothing is active", () => {
    const { container } = renderCard({ printingImages: [] });

    expect(container.querySelector('img[alt="OGN-001::foil"]')).toBeNull();
  });

  it("offers a source link from the menu while the printing has none", () => {
    const { getByText } = renderCard();

    expect(getByText("Add source link")).toBeTruthy();
  });

  it("marks a source image the printing already carries as used", () => {
    renderCard({
      candidatePrintings: [
        stubSource({ id: "cp1", imageUrl: "https://cdn.test/a.png" }),
        stubSource({ id: "cp2", imageUrl: "https://cdn.test/b.png" }),
      ],
      printingImages: [stubImage({ originalUrl: "https://cdn.test/a.png" })],
    });

    expect(captured.sourceImageCells).toEqual([
      { url: "https://cdn.test/a.png", isUsed: true },
      { url: "https://cdn.test/b.png", isUsed: false },
    ]);
  });

  it("offers other printings' images as substitute art, never this printing's own", () => {
    const own = stubPrinting({ id: "p1" });
    const sibling = stubPrinting({ id: "p2", expectedPrintingId: "OGN-001 · foil · EN" });
    renderCard({
      printing: own,
      printings: [own, sibling],
      printingImages: [
        stubImage({ id: "img1", imageFileId: "file-1" }),
        stubImage({ id: "img2", printingId: "p2", imageFileId: "file-2" }),
      ],
    });

    expect(captured.switcher?.siblingImages).toEqual([
      { imageFileId: "file-2", printingLabel: "OGN-001 · foil · EN" },
    ]);
  });

  it("offers a shared image file once", () => {
    const own = stubPrinting({ id: "p1" });
    renderCard({
      printing: own,
      printings: [own, stubPrinting({ id: "p2" }), stubPrinting({ id: "p3" })],
      printingImages: [
        stubImage({ id: "img2", printingId: "p2", imageFileId: "file-shared" }),
        stubImage({ id: "img3", printingId: "p3", imageFileId: "file-shared" }),
      ],
    });

    expect(captured.switcher?.siblingImages).toHaveLength(1);
  });

  it("renders the body only while expanded, and folds on a header click", () => {
    const { getByText } = renderCard();
    expect(captured.spreadsheet).not.toBeNull();

    captured.spreadsheet = null;
    getByText("OGN-001::foil").click();

    expect(useAdminCardFoldStore.getState().collapsedByCard[CARD_ID]?.has("p1")).toBe(true);
    expect(captured.spreadsheet).toBeNull();
  });

  it("starts collapsed when the store already has the printing folded", () => {
    useAdminCardFoldStore.getState().togglePrinting(CARD_ID, "p1");
    renderCard();

    expect(captured.spreadsheet).toBeNull();
  });

  it("names each unchecked source, and checks the one that is clicked", () => {
    const { getByText, queryByText } = renderCard({
      candidatePrintings: [
        stubSource({ id: "cp1", candidateCardId: "cc1", checkedAt: null }),
        stubSource({ id: "cp2", candidateCardId: "cc2", checkedAt: null }),
        stubSource({ id: "cp3", candidateCardId: "cc3" }),
      ],
      sourceLabels: { cc1: "gallery", cc2: "piltover", cc3: "riftbinder" },
    });

    expect(queryByText("riftbinder")).toBeNull();
    getByText("piltover").click();
    expect(captured.checkSource).toHaveBeenCalledWith("cp2");
  });

  it("offers one more button to check every unchecked source at once", () => {
    const { getByText } = renderCard({
      candidatePrintings: [
        stubSource({ id: "cp1", candidateCardId: "cc1", checkedAt: null }),
        stubSource({ id: "cp2", candidateCardId: "cc2", checkedAt: null }),
      ],
      sourceLabels: { cc1: "gallery", cc2: "piltover" },
    });

    getByText("All 2").click();
    expect(captured.checkAll).toHaveBeenCalledWith({ printingId: "p1" });
  });

  it("names no source once every one of them is checked", () => {
    const { queryByText } = renderCard({
      candidatePrintings: [stubSource({ candidateCardId: "cc1" })],
      sourceLabels: { cc1: "gallery" },
    });

    expect(queryByText("gallery")).toBeNull();
  });

  it("hides the triage actions from non-admins", () => {
    const { queryByText } = renderCard({
      isAdmin: false,
      candidatePrintings: [stubSource({ candidateCardId: "cc1", checkedAt: null })],
      sourceLabels: { cc1: "gallery" },
    });

    expect(queryByText("gallery")).toBeNull();
    expect(captured.spreadsheet).not.toBeNull();
  });

  it("shows the citation editor to admins", () => {
    expect(renderCard().queryByTestId("citations-editor")).not.toBeNull();
  });

  it("hides the citation editor from a card-review grant holder", () => {
    expect(renderCard({ isAdmin: false }).queryByTestId("citations-editor")).toBeNull();
  });

  it("renders the language prefix as a chip", () => {
    const { getByText } = renderCard({
      printing: stubPrinting({ expectedPrintingId: "EN:OGN-001::foil" }),
    });

    expect(getByText("EN")).toBeTruthy();
    expect(getByText("OGN-001::foil")).toBeTruthy();
  });

  it("starts folded when it is not the card's first printing", () => {
    renderCard({ defaultExpanded: false });

    expect(captured.spreadsheet).toBeNull();
  });

  it("offers the old value back after accepting one from a source", () => {
    renderCard({
      printing: stubPrinting({ artist: "Base Artist" }),
      candidatePrintings: [stubSource({ id: "cp1", candidateCardId: "cc1" })],
      sourceLabels: { cc1: "tacter" },
      printingSourceFields: [{ key: "artist", label: "Artist" }],
    });

    captured.spreadsheet?.onCellClick?.("artist", "Zoya", "cp1");

    expect(captured.acceptField).toHaveBeenCalledWith({
      printingId: "p1",
      field: "artist",
      value: "Zoya",
      source: "provider",
    });

    const [message, options] = captured.toastSuccess.mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    expect(message).toBe("Used Artist from tacter");

    options.action.onClick();
    expect(captured.acceptField).toHaveBeenLastCalledWith({
      printingId: "p1",
      field: "artist",
      value: "Base Artist",
      source: "manual",
    });
  });

  it("writes an empty previous value back as null", () => {
    renderCard({
      printing: stubPrinting({ artist: undefined }),
      candidatePrintings: [stubSource({ id: "cp1", candidateCardId: "cc1" })],
      sourceLabels: { cc1: "tacter" },
      printingSourceFields: [{ key: "artist", label: "Artist" }],
    });

    captured.spreadsheet?.onCellClick?.("artist", "Zoya", "cp1");
    const [, options] = captured.toastSuccess.mock.calls[0] as [
      string,
      { action: { onClick: () => void } },
    ];
    options.action.onClick();

    expect(captured.acceptField).toHaveBeenLastCalledWith({
      printingId: "p1",
      field: "artist",
      value: null,
      source: "manual",
    });
  });
});
