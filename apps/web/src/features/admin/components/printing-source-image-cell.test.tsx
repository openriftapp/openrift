import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RunWrite } from "@/features/admin/lib/run-write";

const captured = vi.hoisted(() => ({
  setImage: vi.fn((..._args: unknown[]) => Promise.resolve()),
}));

vi.mock("@/features/admin/hooks/use-admin-image-mutations", () => ({
  useSetCandidatePrintingImage: () => ({ mutateAsync: captured.setImage, isPending: false }),
}));

import { PrintingSourceImageCell } from "./printing-source-image-cell";

function renderCell(isUsed = false, runWrite?: RunWrite) {
  return render(
    <PrintingSourceImageCell
      candidatePrintingId="cp-1"
      url="https://cdn.test/a.png"
      sourceLabel="gallery"
      isUsed={isUsed}
      landscape={false}
      runWrite={runWrite}
    />,
  );
}

beforeEach(() => {
  captured.setImage.mockClear();
});

describe("PrintingSourceImageCell", () => {
  it("offers both slots for an image the printing does not carry", async () => {
    const user = userEvent.setup();
    renderCell();

    await user.click(screen.getByRole("button", { name: "Main" }));
    await user.click(screen.getByRole("button", { name: "Beside" }));

    expect(captured.setImage).toHaveBeenNthCalledWith(
      1,
      { candidatePrintingId: "cp-1", mode: "main" },
      { signal: undefined },
    );
    expect(captured.setImage).toHaveBeenNthCalledWith(
      2,
      { candidatePrintingId: "cp-1", mode: "additional" },
      { signal: undefined },
    );
  });

  it("stores the image through the caller's write runner and its signal", async () => {
    const user = userEvent.setup();
    const { signal } = new AbortController();
    const runWrite = vi.fn<RunWrite>((write) => write(signal).then(() => true));
    renderCell(false, runWrite);

    await user.click(screen.getByRole("button", { name: "Beside" }));

    expect(runWrite).toHaveBeenCalledOnce();
    expect(captured.setImage).toHaveBeenCalledWith(
      { candidatePrintingId: "cp-1", mode: "additional" },
      { signal },
    );
  });

  it("says an image is already used instead of offering it again", () => {
    renderCell(true);

    expect(screen.getByText("Already used")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Main" })).not.toBeInTheDocument();
  });

  it("links the image to its source", () => {
    renderCell();

    expect(screen.getByRole("link")).toHaveAttribute("href", "https://cdn.test/a.png");
  });
});
