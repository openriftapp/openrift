import type { ImageQuad } from "@openrift/shared/contracts/admin/card-images";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  serving: { status: "loading", assets: null } as {
    status: string;
    assets: { boardDetectorUrl: string } | null;
  },
  detect: vi.fn(async () => null),
  prepare: vi.fn(),
  setQuad: vi.fn(),
}));

vi.mock("@/features/scan/hooks/use-scan-serving", () => ({
  useScanServing: () => state.serving,
}));
vi.mock("@/features/admin/hooks/use-admin-image-mutations", () => ({
  useEnsurePrintingImageOriginal: () => ({ mutateAsync: state.prepare }),
  useSetPrintingImageQuad: () => ({ mutateAsync: state.setQuad, isPending: false }),
}));
vi.mock("@/features/admin/lib/straighten-detect", () => ({
  detectQuadInOriginal: state.detect,
}));
vi.mock("@/features/admin/lib/straighten-preview", () => ({
  drawStraightenedPreview: vi.fn(),
  readPreviewSource: () => null,
}));

const { StraightenImageDialog } = await import("./straighten-image-dialog");

const STORED_QUAD: ImageQuad = [
  { x: 10, y: 10 },
  { x: 700, y: 10 },
  { x: 700, y: 1000 },
  { x: 10, y: 1000 },
];

beforeEach(() => {
  state.prepare.mockReset().mockResolvedValue({
    url: "/media/original.png",
    width: 744,
    height: 1039,
  });
  state.setQuad.mockReset().mockResolvedValue(undefined);
});

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

  it("prepares and saves directly when no runWrite is given", async () => {
    const user = userEvent.setup();
    render(
      <StraightenImageDialog imageId="img-1" quad={STORED_QUAD} open onOpenChange={vi.fn()} />,
    );
    await user.click(await screen.findByRole("button", { name: "Remove straightening" }));

    expect(state.prepare).toHaveBeenCalledWith("img-1", { signal: undefined });
    expect(state.setQuad).toHaveBeenCalledWith(
      { imageId: "img-1", quad: null },
      { signal: undefined },
    );
  });

  it("hands both writes to runWrite, which passes its signal into each mutation", async () => {
    const user = userEvent.setup();
    const { signal } = new AbortController();
    const runWrite = vi.fn((write: (signal?: AbortSignal) => Promise<unknown>) =>
      write(signal).then(() => true),
    );
    const onOpenChange = vi.fn();
    render(
      <StraightenImageDialog
        imageId="img-1"
        quad={STORED_QUAD}
        open
        onOpenChange={onOpenChange}
        runWrite={runWrite}
      />,
    );
    await user.click(await screen.findByRole("button", { name: "Remove straightening" }));

    expect(runWrite).toHaveBeenCalledTimes(2);
    expect(state.prepare).toHaveBeenCalledWith("img-1", { signal });
    expect(state.setQuad).toHaveBeenCalledWith({ imageId: "img-1", quad: null }, { signal });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes without its own error when the queued prepare runs out of time", async () => {
    const controller = new AbortController();
    controller.abort();
    const onOpenChange = vi.fn();
    render(
      <StraightenImageDialog
        imageId="img-1"
        quad={null}
        open
        onOpenChange={onOpenChange}
        runWrite={(write) => write(controller.signal).then(() => false)}
      />,
    );

    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(screen.queryByText("The original could not be prepared.")).not.toBeInTheDocument();
  });
});
