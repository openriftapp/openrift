import type { DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMutateAsync = vi.hoisted(() => vi.fn());
let flavorText: string | null = null;
let release: Pick<DeskPrintingRow, "releasedAt" | "releasePrecision"> = {
  releasedAt: null,
  releasePrecision: null,
};

function row(): DeskPrintingRow {
  return {
    printingId: "p-1",
    slug: "en-ogn-101-foil-standard",
    cardId: "c-1",
    cardSlug: "annie-dark-child",
    cardName: "Annie, Dark Child",
    cardType: "Champion Unit",
    setId: "s-1",
    setName: "Origins",
    setSlug: "origins",
    shortCode: "OGN-101",
    publicCode: "OGN-101",
    rarity: "epic",
    finish: "foil",
    language: "en",
    size: "standard",
    artist: "Test Artist",
    markerSlugs: [],
    distributionChannelSlugs: [],
    announcedAt: null,
    ...release,
    setReleasedAt: null,
    setReleasePrecision: null,
    comment: null,
    flavorText,
    imageCount: 0,
    faceId: "f-1",
    side: 1,
    secondSide: null,
    sharedWith: [],
    activeImageFileId: null,
    activeImageUrl: null,
    createdAt: "2026-03-01T12:00:00Z",
    updatedAt: "2026-03-01T12:00:00Z",
    canEdit: true,
  };
}

vi.mock("@tanstack/react-router", () => ({
  createLink: (component: unknown) => component,
  Link: () => null,
  useNavigate: () => vi.fn(),
}));

vi.mock("@/features/admin/hooks/use-printing-desk", () => ({
  useDeskPrinting: () => ({ data: { printing: row(), images: [] } }),
  useDeskCardPrintings: () => ({ data: { card: { id: "c-1", name: "Annie" }, printings: [] } }),
  useCreateDeskPrinting: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateDeskPrinting: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
}));

vi.mock("@/features/admin/components/printing-desk-marker-picker", () => ({
  PrintingDeskMarkerPicker: () => <div>Markers</div>,
}));

vi.mock("@/features/admin/components/printing-desk-channel-picker", () => ({
  PrintingDeskChannelPicker: () => <div>Channels</div>,
}));

vi.mock("@/features/admin/components/printing-desk-pack-odds", () => ({
  PrintingDeskPackOdds: () => <div>Booster packs</div>,
}));

vi.mock("@/features/admin/components/set-picker", () => ({
  SetPicker: () => <div>Set</div>,
}));

vi.mock("@/features/admin/components/language-select", () => ({
  LanguageSelect: () => <div>Language</div>,
}));

vi.mock("@/features/cards/hooks/use-distinct-artists", () => ({
  useDistinctArtists: () => ({ data: [] }),
}));

vi.mock("@/hooks/use-effective-language-order", () => ({
  useEffectiveLanguageOrder: () => ["en"],
}));

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({
    orders: { finishes: ["foil"], cardSizes: ["standard"] },
    labels: { finishes: {}, cardSizes: {}, rarities: {}, cardTypes: {} },
  }),
  useLanguageLabels: () => ({}),
}));

const { PrintingDeskEditFields } = await import("./printing-desk-form-page");

beforeEach(() => {
  vi.clearAllMocks();
  updateMutateAsync.mockResolvedValue(undefined);
  flavorText = null;
  release = { releasedAt: null, releasePrecision: null };
});

describe("PrintingDeskEditFields release precision", () => {
  it("keeps a stored quarter instead of saving it as a month", async () => {
    release = { releasedAt: "2026-04-01", releasePrecision: "quarter" };
    const user = userEvent.setup();
    render(
      <PrintingDeskEditFields
        printingId="p-1"
        scope="printing"
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Quarter" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(updateMutateAsync.mock.calls[0]?.[0]).not.toHaveProperty("releasePrecision", "month");
  });
});

describe("PrintingDeskEditFields flavor text", () => {
  it("saves the flavor text a face edit typed", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <PrintingDeskEditFields printingId="p-1" scope="face" onSaved={onSaved} onCancel={vi.fn()} />,
    );

    await user.type(screen.getByLabelText("Flavor text"), "  The fire starts small.  ");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(updateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ printingId: "p-1", flavorText: "The fire starts small." }),
    );
    expect(updateMutateAsync.mock.calls[0]?.[0]).not.toHaveProperty("comment");
    expect(onSaved).toHaveBeenCalled();
  });

  it("clears the flavor text to null when the field is emptied", async () => {
    flavorText = "Tibbers wants to play.";
    const user = userEvent.setup();
    render(
      <PrintingDeskEditFields printingId="p-1" scope="face" onSaved={vi.fn()} onCancel={vi.fn()} />,
    );

    const field = screen.getByLabelText("Flavor text");
    expect(field).toHaveValue("Tibbers wants to play.");
    await user.clear(field);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(updateMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ flavorText: null }));
  });

  it("leaves flavor text out of a printing-only edit", async () => {
    const user = userEvent.setup();
    render(
      <PrintingDeskEditFields
        printingId="p-1"
        scope="printing"
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Flavor text")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(updateMutateAsync.mock.calls[0]?.[0]).not.toHaveProperty("flavorText");
  });
});
