import type { AdminPrintingImageResponse } from "@openrift/shared/types/api/admin";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  DropdownMenuSeparator: () => null,
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/features/admin/components/straighten-image-dialog", () => ({
  StraightenImageDialog: () => null,
}));

vi.mock("@/features/admin/hooks/use-admin-image-mutations", () => {
  const idle = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return {
    useActivatePrintingImage: idle,
    useAddFallbackArtUrl: idle,
    useAddImageFromUrl: idle,
    useDeletePrintingImage: idle,
    useImageEditPending: (imageId: string) => state.editingImageIds.includes(imageId),
    useRehostPrintingImage: idle,
    useRotatePrintingImage: idle,
    useSetFallbackArt: idle,
    useSetPrintingImageNeedsTrim: idle,
    useUnrehostPrintingImage: idle,
    useUploadFallbackArt: idle,
    useUploadPrintingImage: idle,
  };
});

const { PrintingImageSwitcher } = await import("./printing-image-switcher");

const image = {
  id: "img-1",
  printingId: "p-1",
  imageFileId: "file-1",
  face: "front",
  originalUrl: "https://cdn.test/a.png",
  rehostedUrl: "/media/cards/fi/file-1",
  isActive: true,
  rotation: 0,
  needsTrim: false,
  quad: null,
} as unknown as AdminPrintingImageResponse;

function renderSwitcher() {
  return render(
    <PrintingImageSwitcher
      printingId="p-1"
      face="front"
      printingLabel="OGN-001"
      images={[image]}
      siblingImages={[]}
      derivedArtLabel={null}
      fallbackArtMode="auto"
      fallbackImageFileId={null}
      providerSettings={[]}
      isAdmin
    />,
  );
}

beforeEach(() => {
  state.editingImageIds = [];
});

describe("PrintingImageSwitcher file edits", () => {
  it("holds rotate, trim and straighten while any of them is saving", () => {
    state.editingImageIds = ["img-1"];
    renderSwitcher();

    for (const name of [/^Straighten/u, /^Rotate left/u, /^Rotate right/u, /^Auto-trim/u]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });

  it("offers them again once the image is idle", () => {
    renderSwitcher();

    for (const name of [/^Straighten/u, /^Rotate left/u, /^Rotate right/u, /^Auto-trim/u]) {
      expect(screen.getByRole("button", { name })).toBeEnabled();
    }
  });
});
