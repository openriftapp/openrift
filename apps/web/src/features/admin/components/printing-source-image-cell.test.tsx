import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({ setImage: vi.fn() }));

vi.mock("@/features/admin/hooks/use-admin-image-mutations", () => ({
  useSetCandidatePrintingImage: () => ({ mutate: captured.setImage, isPending: false }),
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { PrintingSourceImageCell } from "./printing-source-image-cell";

function renderCell(isUsed = false) {
  return render(
    <PrintingSourceImageCell
      candidatePrintingId="cp-1"
      url="https://cdn.test/a.png"
      sourceLabel="gallery"
      isUsed={isUsed}
    />,
  );
}

beforeEach(() => {
  captured.setImage.mockReset();
});

describe("PrintingSourceImageCell", () => {
  it("offers both slots for an image the printing does not carry", async () => {
    const user = userEvent.setup();
    renderCell();

    await user.click(screen.getByRole("button", { name: "Main" }));
    await user.click(screen.getByRole("button", { name: "Beside" }));

    expect(captured.setImage).toHaveBeenNthCalledWith(1, {
      candidatePrintingId: "cp-1",
      mode: "main",
    });
    expect(captured.setImage).toHaveBeenNthCalledWith(2, {
      candidatePrintingId: "cp-1",
      mode: "additional",
    });
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
