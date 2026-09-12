import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Dropzone } from "./dropzone";

let coarsePointer = false;

vi.mock("@/hooks/use-coarse-pointer", () => ({
  useCoarsePointer: () => coarsePointer,
}));

function file(name: string) {
  return new File(["x"], name, { type: "image/png" });
}

describe("Dropzone", () => {
  beforeEach(() => {
    coarsePointer = false;
  });

  it("labels the hidden input with the panel's own label", () => {
    render(<Dropzone label="Drop photos here" onFiles={vi.fn()} />);

    expect(screen.getByLabelText("Drop photos here")).toBeInTheDocument();
  });

  it("reports a file chosen through the input", async () => {
    const user = userEvent.setup();
    const onFiles = vi.fn();
    render(<Dropzone label="Drop photos here" onFiles={onFiles} />);

    await user.upload(screen.getByLabelText("Drop photos here"), file("front.png"));

    expect(onFiles).toHaveBeenCalledWith([expect.objectContaining({ name: "front.png" })]);
  });

  it("keeps only the first file when it is not multiple", () => {
    const onFiles = vi.fn();
    render(<Dropzone label="Drop photos here" onFiles={onFiles} />);

    fireEvent.drop(screen.getByText("Drop photos here"), {
      dataTransfer: { files: [file("a.png"), file("b.png")] },
    });

    expect(onFiles.mock.calls[0]?.[0]).toHaveLength(1);
  });

  it("keeps every file when it is multiple", () => {
    const onFiles = vi.fn();
    render(<Dropzone multiple label="Drop photos here" onFiles={onFiles} />);

    fireEvent.drop(screen.getByText("Drop photos here"), {
      dataTransfer: { files: [file("a.png"), file("b.png")] },
    });

    expect(onFiles.mock.calls[0]?.[0]).toHaveLength(2);
  });

  it("stays quiet on an empty drop", () => {
    const onFiles = vi.fn();
    render(<Dropzone label="Drop photos here" onFiles={onFiles} />);

    fireEvent.drop(screen.getByText("Drop photos here"), { dataTransfer: { files: [] } });

    expect(onFiles).not.toHaveBeenCalled();
  });

  it("marks itself while a file is dragged over it", () => {
    const { container } = render(<Dropzone label="Drop photos here" onFiles={vi.fn()} />);
    const zone = container.querySelector('[data-slot="dropzone"]');

    fireEvent.dragOver(zone!);
    expect(zone).toHaveAttribute("data-dragging");

    fireEvent.dragLeave(zone!);
    expect(zone).not.toHaveAttribute("data-dragging");
  });

  it("ignores a drop while disabled", () => {
    const onFiles = vi.fn();
    render(<Dropzone disabled label="Drop photos here" onFiles={onFiles} />);

    fireEvent.drop(screen.getByText("Drop photos here"), {
      dataTransfer: { files: [file("a.png")] },
    });

    expect(onFiles).not.toHaveBeenCalled();
  });

  it("shows the hint next to the label", () => {
    render(<Dropzone label="Drop photos here" hint="JPG, PNG or WebP" onFiles={vi.fn()} />);

    expect(screen.getByText("JPG, PNG or WebP")).toBeInTheDocument();
  });

  it("hides the camera action on a fine pointer", () => {
    render(<Dropzone label="Drop photos here" cameraLabel="Take a photo" onFiles={vi.fn()} />);

    expect(screen.queryByLabelText("Take a photo")).not.toBeInTheDocument();
  });

  it("opens the camera on a coarse pointer", async () => {
    coarsePointer = true;
    const user = userEvent.setup();
    const onFiles = vi.fn();
    render(<Dropzone label="Drop photos here" cameraLabel="Take a photo" onFiles={onFiles} />);

    const input = screen.getByLabelText("Take a photo");
    expect(input).toHaveAttribute("capture", "environment");

    await user.upload(input, file("front.png"));

    expect(onFiles).toHaveBeenCalledWith([expect.objectContaining({ name: "front.png" })]);
  });
});
