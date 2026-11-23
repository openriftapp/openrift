import type {
  AdminCardDetailResponse,
  AdminPrintingImageResponse,
  AdminPrintingResponse,
} from "@openrift/shared/types/api/admin";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RunWrite } from "@/features/admin/lib/run-write";
import {
  resetWorkspaceWriteQueue,
  workspaceWriteQueue,
} from "@/features/catalog-workspace/lib/workspace-write-queue";

const state = vi.hoisted(() => ({
  editingImageIds: [] as string[],
  rotate: {
    mutate: vi.fn(),
    mutateAsync: vi.fn(async (..._args: unknown[]) => {}),
    isPending: false,
  },
  straightenRunWrite: [] as unknown[],
}));

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
  PrintingImageSwitcher: ({ runWrite }: { runWrite?: unknown }) => {
    state.straightenRunWrite.push(runWrite);
    return null;
  },
}));

vi.mock("@/features/admin/components/straighten-image-dialog", () => ({
  StraightenImageDialog: ({ runWrite }: { runWrite?: unknown }) => {
    state.straightenRunWrite.push(runWrite);
    return null;
  },
}));

vi.mock("@/features/admin/hooks/use-printing-desk", () => ({
  useSetDeskImageFace: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateDeskImage: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/use-session", () => ({ useSession: () => ({ data: null }) }));

vi.mock("@/features/admin/hooks/use-admin", () => ({
  useAdminAccess: () => ({ data: { isAdmin: true, sections: [] } }),
}));

vi.mock("@/features/admin/hooks/use-admin-image-mutations", () => {
  const idle = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return {
    useActivatePrintingImage: idle,
    useAddImageFromUrl: idle,
    useDeletePrintingImage: idle,
    useImageEditPending: (imageId: string) => state.editingImageIds.includes(imageId),
    useKeepPrintingImage: idle,
    useRehostPrintingImage: idle,
    useRotatePrintingImage: () => state.rotate,
    useSetPrintingImageNeedsLevels: idle,
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
  needsLevels: false,
  quad: null,
} as unknown as AdminPrintingImageResponse;

const queryClient = new QueryClient();

function renderSection() {
  return render(
    <QueryClientProvider client={queryClient}>
      <FaceImagesSection
        cardSlug="jinx-loose-cannon"
        face={face}
        detail={
          { printings: [face], printingImages: [inactive] } as unknown as AdminCardDetailResponse
        }
        images={[inactive]}
        printings={[face]}
        providerSettings={[]}
        isAdmin={false}
        landscape={false}
      />
    </QueryClientProvider>,
  );
}

const EDITS = [
  /^Rotate left/u,
  /^Rotate right/u,
  /^Straighten/u,
  /^Turn auto-trim/u,
  /^Turn contrast/u,
];

beforeEach(() => {
  state.editingImageIds = [];
  state.rotate.mutateAsync.mockClear();
  state.straightenRunWrite = [];
});

afterEach(() => {
  resetWorkspaceWriteQueue();
});

describe("FaceImagesSection writes", () => {
  it("rotates an image only after the workspace write queued before it settles", async () => {
    const gate = { open: () => {} };
    const earlier = workspaceWriteQueue().enqueue(
      null,
      () =>
        new Promise<void>((resolve) => {
          gate.open = resolve;
        }),
      { queryClient },
    );
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: /^Rotate left/u }));
    await Promise.resolve();
    expect(state.rotate.mutateAsync).not.toHaveBeenCalled();
    gate.open();
    await earlier;

    await vi.waitFor(() => expect(state.rotate.mutateAsync).toHaveBeenCalledOnce());
    expect(state.rotate.mutateAsync).toHaveBeenCalledWith(
      { imageId: "img-2", rotation: 270 },
      { signal: expect.any(AbortSignal) },
    );
  });

  it("hands the image switcher and straighten dialogs a runWrite that queues behind earlier writes", async () => {
    const gate = { open: () => {} };
    const earlier = workspaceWriteQueue().enqueue(
      null,
      () =>
        new Promise<void>((resolve) => {
          gate.open = resolve;
        }),
      { queryClient },
    );
    renderSection();

    const runWrites = state.straightenRunWrite as RunWrite[];
    expect(runWrites.length).toBeGreaterThanOrEqual(2);
    const calls = runWrites.map((runWrite) => {
      const write = vi.fn(async (_signal?: AbortSignal) => {});
      return { write, landed: runWrite(write) };
    });
    await Promise.resolve();
    for (const { write } of calls) {
      expect(write).not.toHaveBeenCalled();
    }
    gate.open();
    await earlier;

    for (const { write, landed } of calls) {
      await expect(landed).resolves.toBe(true);
      expect(write).toHaveBeenCalledWith(expect.any(AbortSignal));
    }
  });
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
