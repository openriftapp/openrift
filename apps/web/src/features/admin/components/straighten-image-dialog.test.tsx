import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  serving: { status: "loading", assets: null } as {
    status: string;
    assets: { boardDetectorUrl: string } | null;
  },
  detect: vi.fn(async () => null),
}));

vi.mock("@/features/scan/hooks/use-scan-serving", () => ({
  useScanServing: () => state.serving,
}));
vi.mock("@/features/admin/hooks/use-admin-image-mutations", () => ({
  useEnsurePrintingImageOriginal: () => ({
    mutateAsync: async () => ({ url: "/media/original.png", width: 744, height: 1039 }),
  }),
  useSetPrintingImageQuad: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/features/admin/lib/straighten-detect", () => ({
  detectQuadInOriginal: state.detect,
}));
vi.mock("@/features/admin/lib/straighten-preview", () => ({
  drawStraightenedPreview: vi.fn(),
  readPreviewSource: () => null,
}));

const { StraightenImageDialog } = await import("./straighten-image-dialog");

describe("StraightenImageDialog", () => {
  it("runs detection once the scan manifest finishes loading after the original landed", async () => {
    const { rerender } = render(
      <StraightenImageDialog imageId="img-1" quad={null} open onOpenChange={vi.fn()} />,
    );
    await vi.waitFor(() =>
      expect(screen.queryByText("Preparing the original…")).not.toBeInTheDocument(),
    );
    expect(state.detect).not.toHaveBeenCalled();

    state.serving = { status: "ready", assets: { boardDetectorUrl: "/scan/board.onnx" } };
    rerender(<StraightenImageDialog imageId="img-1" quad={null} open onOpenChange={vi.fn()} />);

    await vi.waitFor(() =>
      expect(state.detect).toHaveBeenCalledWith("/scan/board.onnx", "/media/original.png"),
    );
    expect(screen.queryByText(/Card detection is unavailable/u)).not.toBeInTheDocument();
  });
});
