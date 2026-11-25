import type { DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";
import { labelMapOf } from "@openrift/shared/enum-label";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

function deskRow(printingId: string): DeskPrintingRow {
  return {
    printingId,
    slug: printingId,
    cardId: "card-1",
    cardSlug: "jinx",
    cardName: "Jinx",
    cardType: "unit",
    setId: "set-1",
    setName: "Origins",
    setSlug: "OGN",
    shortCode: "OGN-001",
    publicCode: "OGN-001/298",
    rarity: "rare",
    finish: "normal",
    language: "EN",
    size: "standard",
    artist: "Kudos",
    markerSlugs: [],
    distributionChannelSlugs: [],
    announcedAt: null,
    releasedAt: null,
    releasePrecision: null,
    setReleasedAt: null,
    setReleasePrecision: null,
    comment: null,
    flavorText: null,
    imageCount: 0,
    faceId: "face-1",
    side: 1,
    secondSide: null,
    sharedWith: [],
    activeImageFileId: null,
    activeImageUrl: null,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    canEdit: true,
  };
}

const state = vi.hoisted(() => ({ fromPrintingId: "p-1" }));
const rows = [deskRow("p-1"), deskRow("p-2")];

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  Link: ({ children }: { children: ReactNode }) => <a href="/printing">{children}</a>,
  useLocation: ({ select }: { select: (location: object) => unknown }) =>
    select({ state: { workspaceFromPrintingId: state.fromPrintingId } }),
}));
vi.mock("@/features/admin/hooks/use-admin", () => ({
  useAdminAccess: () => ({ data: { isAdmin: false }, isPending: false }),
}));
vi.mock("@/features/admin/lib/admin-sections", () => ({ hasAdminSection: () => false }));
vi.mock("@/features/admin/lib/printing-desk-queries", () => ({
  deskCardPrintingsQueryOptions: (cardSlug: string) => ({
    queryKey: ["desk-card", cardSlug],
    queryFn: () => ({ printings: rows }),
  }),
}));
vi.mock("@/features/admin/hooks/use-printing-desk", () => ({
  useDeskCardPrintings: () => ({ data: { printings: rows } }),
  useDeskPrinting: (printingId: string) => ({
    data: { printing: rows.find((row) => row.printingId === printingId), images: [] },
  }),
}));
vi.mock("@/features/admin/components/printing-desk-form-page", () => ({
  PrintingDeskEditFields: ({ printingId }: { printingId: string }) => <p>Editing {printingId}</p>,
}));
vi.mock("@/features/catalog-workspace/components/face-images-section", () => ({
  DeskFaceImagesSection: () => null,
  FaceImagesSection: () => null,
}));
vi.mock("@/features/catalog-workspace/hooks/use-value-labels", () => ({
  useValueLabels: () => ({ channels: labelMapOf({}) }),
}));
vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({ orders: {}, labels: {} }),
}));

const { FaceRecord } = await import("./face-record");

function renderRecord(client: QueryClient) {
  return (
    <QueryClientProvider client={client}>
      <FaceRecord cardSlug="jinx" faceId="face-1" />
    </QueryClientProvider>
  );
}

describe("FaceRecord for a desk holder", () => {
  it("closes the face editor when the record switches to another printing of the face", () => {
    const client = new QueryClient();
    client.setQueryData(["desk-card", "jinx"], { printings: rows });
    const { rerender } = render(renderRecord(client));

    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0] as HTMLElement);
    expect(screen.getByText("Editing p-1")).toBeVisible();

    state.fromPrintingId = "p-2";
    rerender(renderRecord(client));

    expect(screen.queryByText(/^Editing/u)).toBeNull();
  });
});
