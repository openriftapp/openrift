import type {
  DeskImage,
  DeskPrintingRow,
  DeskSecondSide,
} from "@openrift/shared/contracts/admin/printing-desk";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  canEdit: false,
  isAdmin: false,
  sections: [] as string[],
  secondSide: null as DeskSecondSide | null,
  images: [] as DeskImage[],
  cardPrintings: [] as { id: string }[],
}));
const activate = vi.hoisted(() => vi.fn());
const removeFace = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to?: string; children?: ReactNode }) => (
    <a href={to ?? "/admin/printing-desk"}>{children}</a>
  ),
  createLink: (component: unknown) => component,
  useNavigate: () => vi.fn(),
}));

vi.mock("@/features/admin/components/admin-page-top-bar", () => ({
  AdminPageTopBar: ({ title, actions }: { title?: string; actions?: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {actions}
    </div>
  ),
}));

vi.mock("@/features/admin/components/printing-desk-form-page", () => ({
  PrintingDeskEditFields: ({ scope }: { scope?: string }) => <div>Edit {scope} fields</div>,
}));

vi.mock("@/features/admin/components/printing-admin-sections", () => ({
  PrintingSourcesCard: () => <div>Sources section</div>,
  PrintingMarketplaceCard: () => <div>Marketplace section</div>,
  PrintingHistoryCard: () => <div>History section</div>,
}));

vi.mock("@/features/admin/components/side-search", () => ({
  SideSearch: () => <input aria-label="Find a face" />,
}));

vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  useDeletePrinting: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/features/admin/hooks/use-admin", () => ({
  useAdminAccess: () => ({ data: { isAdmin: state.isAdmin, sections: state.sections } }),
}));

vi.mock("@/features/admin/hooks/use-printing-desk", () => ({
  useDeskPrinting: () => ({ data: { printing: row(), images: state.images } }),
  useSetDeskImageFace: () => ({ mutate: vi.fn() }),
  useUpdateDeskImage: () => ({ mutate: vi.fn() }),
  useSetDeskSecondSide: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useRemoveDeskSecondSide: () => ({ mutate: removeFace, isPending: false, error: null }),
}));

vi.mock("@/features/admin/hooks/use-admin-image-mutations", () => ({
  useActivatePrintingImage: () => ({ mutate: activate }),
  useDeletePrintingImage: () => ({ mutate: vi.fn() }),
  useRotatePrintingImage: () => ({ mutate: vi.fn() }),
  useUploadPrintingImage: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/features/admin/hooks/use-admin-printing-citations", () => ({
  useAdminPrintingCitations: () => ({ data: { citations: [] } }),
  useCreatePrintingCitation: () => ({ mutate: vi.fn(), isPending: false }),
  useDeletePrintingCitation: () => ({ mutate: vi.fn() }),
  useUpdatePrintingCitation: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/features/admin/hooks/use-distribution-channels", () => ({
  useDistributionChannels: () => ({ data: { distributionChannels: [] } }),
}));

vi.mock("@/features/admin/hooks/use-markers", () => ({
  useMarkers: () => ({ data: { markers: [{ id: "m-1", slug: "stamped", label: "Stamped" }] } }),
}));

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({
    labels: {
      finishes: { foil: "Foil", normal: "Normal" },
      cardSizes: { standard: "Standard" },
      rarities: { epic: "Epic", common: "Common" },
    },
  }),
  useLanguageLabels: () => ({ en: "English" }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  // oxlint-disable-next-line typescript/consistent-type-imports -- vitest dynamic import pattern
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useSuspenseQuery: () => ({ data: { printings: state.cardPrintings } }),
}));

vi.mock("@/features/cards/lib/card-detail-queries", () => ({
  freshCardDetailQueryOptions: () => ({ queryKey: ["card-detail"] }),
}));

vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ data: { user: { name: "Nexus Scout" } } }),
}));

const { PrintingPage } = await import("./printing-page");

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
    artist: "Kudos Productions",
    markerSlugs: ["stamped"],
    distributionChannelSlugs: [],
    announcedAt: null,
    releasedAt: null,
    releasePrecision: null,
    comment: null,
    imageCount: 0,
    faceId: "face-1",
    side: 1,
    secondSide: state.secondSide,
    sharedWith: [],
    activeImageFileId: null,
    activeImageUrl: null,
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-02T11:00:00.000Z",
    canEdit: state.canEdit,
  };
}

function secondFace(): DeskSecondSide {
  return {
    faceId: "face-2",
    cardName: "Gold",
    cardSlug: "gold",
    setId: "s-1",
    setName: "Origins",
    shortCode: "OGN-T05",
    publicCode: "OGN-T05",
    rarity: "common",
    finish: "normal",
    language: "en",
    artist: "Kudos Productions",
    markerSlugs: [],
    sharedWith: [
      { printingId: "p-2", side: 2, slug: "x", cardSlug: "gold", publicCode: "OGN-T09" },
    ],
  };
}

function image(over: Partial<DeskImage> = {}): DeskImage {
  return {
    printingImageId: "pi-1",
    imageFileId: "if-1",
    url: "/media/cards/g1/if-1-full.webp",
    isActive: true,
    rotation: 0,
    face: "front",
    credit: null,
    quad: null,
    canDelete: true,
    ...over,
  };
}

beforeEach(() => {
  state.canEdit = true;
  state.isAdmin = false;
  state.sections = ["printing-desk"];
  state.secondSide = null;
  state.images = [];
  state.cardPrintings = [];
  activate.mockClear();
  removeFace.mockClear();
});

describe("PrintingPage card page preview", () => {
  it("says so while the catalog has no row for the printing", () => {
    render(<PrintingPage printingId="p-1" />);

    expect(screen.getByText(/Not on the card page yet/u)).toBeInTheDocument();
  });
});

describe("PrintingPage faces", () => {
  it("names a double-faced printing after both cards", () => {
    state.secondSide = secondFace();
    render(<PrintingPage printingId="p-1" />);

    expect(screen.getByRole("heading", { name: "Annie, Dark Child // Gold" })).toBeInTheDocument();
    expect(screen.getByText("Face 1 · Annie, Dark Child")).toBeInTheDocument();
    expect(screen.getByText("Face 2 · Gold")).toBeInTheDocument();
  });

  it("links the printings a face is also on", () => {
    state.secondSide = secondFace();
    render(<PrintingPage printingId="p-1" />);

    expect(screen.getByRole("link", { name: "OGN-T09" })).toHaveAttribute(
      "href",
      "/admin/printings/$printingId",
    );
  });

  it("removes the chosen face", async () => {
    state.secondSide = secondFace();
    render(<PrintingPage printingId="p-1" />);

    const [, removeGold] = screen.getAllByRole("button", { name: "Remove this face" });
    await userEvent.click(removeGold!);

    expect(removeFace).toHaveBeenCalledWith({ printingId: "p-1", faceId: "face-2" });
  });

  it("offers a second face on a single-faced printing", () => {
    render(<PrintingPage printingId="p-1" />);

    expect(screen.getByLabelText("Find a face")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove this face" })).not.toBeInTheDocument();
  });

  it("links each face to its card page for card reviewers only", () => {
    const { unmount } = render(<PrintingPage printingId="p-1" />);
    expect(screen.queryByText(/^Review on/u)).not.toBeInTheDocument();
    unmount();

    state.sections = ["printing-desk", "card-review"];
    render(<PrintingPage printingId="p-1" />);
    expect(
      screen.getByRole("link", { name: "Review on Annie, Dark Child's card page" }),
    ).toBeInTheDocument();
  });

  it("edits a face with the face fields only", async () => {
    render(<PrintingPage printingId="p-1" />);

    const [editFace] = screen.getAllByRole("button", { name: "Edit" });
    await userEvent.click(editFace!);

    expect(screen.getByText("Edit face fields")).toBeInTheDocument();
  });
});

describe("PrintingPage images", () => {
  it("clears the active image through the Clear button", async () => {
    state.images = [image()];
    render(<PrintingPage printingId="p-1" />);

    await userEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(activate).toHaveBeenCalledWith({ imageId: "pi-1", active: false });
  });

  it("shows each face only its own images", () => {
    state.secondSide = secondFace();
    state.images = [image(), image({ printingImageId: "pi-2", face: "back", isActive: false })];
    render(<PrintingPage printingId="p-1" />);

    expect(screen.getByRole("radiogroup", { name: "Active image for Gold" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("offers corner picking on an image whose corners are unset", () => {
    state.images = [image()];
    render(<PrintingPage printingId="p-1" />);

    expect(screen.getByRole("button", { name: "Straighten" })).toBeInTheDocument();
  });

  it("says the corners are set once the image carries a quad", () => {
    state.images = [
      image({
        quad: [
          { x: 10, y: 12 },
          { x: 200, y: 12 },
          { x: 200, y: 280 },
          { x: 10, y: 280 },
        ],
      }),
    ];
    render(<PrintingPage printingId="p-1" />);

    expect(screen.getByRole("button", { name: "Straighten (corners set)" })).toBeInTheDocument();
  });

  it("offers no Clear button while no image is active", () => {
    state.images = [image({ isActive: false })];
    render(<PrintingPage printingId="p-1" />);

    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
  });
});

describe("PrintingPage printing fields", () => {
  it("hides the edit buttons when the server says the printing is out of reach", () => {
    state.canEdit = false;
    render(<PrintingPage printingId="p-1" />);

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.getByText(/Not a promo/u)).toBeInTheDocument();
  });

  it("edits the printing with the printing fields only", async () => {
    render(<PrintingPage printingId="p-1" />);

    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    await userEvent.click(editButtons.at(-1)!);

    expect(screen.getByText("Edit printing fields")).toBeInTheDocument();
  });
});

describe("PrintingPage admin sections", () => {
  it("shows sources, listings and history to admins only", () => {
    const { unmount } = render(<PrintingPage printingId="p-1" />);
    expect(screen.queryByText("Sources section")).not.toBeInTheDocument();
    unmount();

    state.isAdmin = true;
    render(<PrintingPage printingId="p-1" />);
    expect(screen.getByText("Sources section")).toBeInTheDocument();
    expect(screen.getByText("Marketplace section")).toBeInTheDocument();
    expect(screen.getByText("History section")).toBeInTheDocument();
  });

  it("offers duplicate and delete to admins only", () => {
    const { unmount } = render(<PrintingPage printingId="p-1" />);
    expect(screen.queryByRole("button", { name: "Printing actions" })).not.toBeInTheDocument();
    unmount();

    state.isAdmin = true;
    render(<PrintingPage printingId="p-1" />);
    expect(screen.getByRole("button", { name: "Printing actions" })).toBeInTheDocument();
  });
});
