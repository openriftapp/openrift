import type {
  AdminCardDetailResponse,
  AdminPrintingImageResponse,
  AdminPrintingResponse,
} from "@openrift/shared/types/api/admin";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FaceSuggestionModel } from "@/features/catalog-workspace/lib/face-suggestion-rows";

const state = vi.hoisted(() => ({ editingImageIds: [] as string[] }));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    disabled,
    onClick,
  }: {
    children?: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/features/admin/components/card-detail-shared", () => ({
  findDerivedArtPrinting: () => null,
}));

vi.mock("@/features/admin/components/printing-image-switcher", () => ({
  PrintingImageSwitcher: () => null,
}));

vi.mock("@/features/admin/components/straighten-image-dialog", () => ({
  StraightenImageDialog: () => null,
}));

vi.mock("@/features/admin/hooks/use-printing-desk", () => ({
  useSetDeskImageFace: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateDeskImage: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/use-session", () => ({ useSession: () => ({ data: null }) }));

vi.mock("@/features/admin/hooks/use-admin-image-mutations", () => {
  const idle = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return {
    useActivatePrintingImage: idle,
    useAddImageFromUrl: idle,
    useDeletePrintingImage: idle,
    useImageEditPending: (imageId: string) => state.editingImageIds.includes(imageId),
    useRehostPrintingImage: idle,
    useRotatePrintingImage: idle,
    useSetCandidatePrintingImage: idle,
    useSetPrintingImageNeedsTrim: idle,
    useUploadPrintingImage: idle,
  };
});

const { FaceImagesSection } = await import("./face-images-section");

const face = {
  id: "p-1",
  side: 1,
  expectedPrintingId: "OGN-001",
  fallbackArtMode: "auto",
  fallbackImageFileId: null,
  otherFace: null,
} as unknown as AdminPrintingResponse;

const inactive = {
  id: "img-2",
  printingId: "p-1",
  imageFileId: "file-2",
  face: "front",
  originalUrl: "https://cdn.test/b.png",
  rehostedUrl: "/media/cards/fi/file-2",
  isActive: false,
  rotation: 0,
  needsTrim: false,
  quad: null,
} as unknown as AdminPrintingImageResponse;

function renderSection() {
  return render(
    <FaceImagesSection
      cardSlug="jinx-loose-cannon"
      face={face}
      detail={
        { printings: [face], printingImages: [inactive] } as unknown as AdminCardDetailResponse
      }
      model={{ printings: [face], images: [inactive] } as unknown as FaceSuggestionModel}
      providerSettings={[]}
      isAdmin={false}
      chips={[]}
      hotkeyOf={() => undefined}
      discardLabelOf={() => "Discard"}
      pending={false}
      onUse={vi.fn()}
      onDiscard={vi.fn()}
      onReject={vi.fn()}
      onReply={vi.fn()}
      landscape={false}
    />,
  );
}

const EDITS = [/^Rotate left/u, /^Rotate right/u, /^Straighten/u, /^Turn auto-trim/u];

beforeEach(() => {
  state.editingImageIds = [];
});

describe("FaceImagesSection inactive image edits", () => {
  it("holds rotate, trim and straighten while any of them is saving", () => {
    state.editingImageIds = ["img-2"];
    renderSection();

    for (const name of EDITS) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });

  it("offers them again once the image is idle", () => {
    renderSection();

    for (const name of EDITS) {
      expect(screen.getByRole("button", { name })).toBeEnabled();
    }
  });
});
