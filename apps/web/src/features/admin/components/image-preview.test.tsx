// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ImagePreview } from "./image-preview";

function loadImage(width: number, height: number) {
  const img = screen.getByRole("img");
  Object.defineProperty(img, "naturalWidth", { configurable: true, value: width });
  Object.defineProperty(img, "naturalHeight", { configurable: true, value: height });
  fireEvent.load(img);
}

describe("ImagePreview", () => {
  it("shows the loaded image's resolution", () => {
    render(<ImagePreview url="/a-full.webp" alt="card" />);
    loadImage(744, 1040);
    expect(screen.getByText("744×1040")).toBeTruthy();
  });

  it("drops the previous image's resolution when the url changes", () => {
    const { rerender } = render(<ImagePreview url="/a-full.webp" alt="card" />);
    loadImage(79, 111);
    rerender(<ImagePreview url="/b-full.webp" alt="card" />);
    expect(screen.queryByText("79×111")).toBeNull();
    loadImage(744, 1040);
    expect(screen.getByText("744×1040")).toBeTruthy();
  });

  it("retries a new url after the previous one failed", () => {
    const { rerender } = render(<ImagePreview url="/a-full.webp" alt="card" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByText("Failed to load — click to open")).toBeTruthy();
    rerender(<ImagePreview url="/b-full.webp" alt="card" />);
    expect(screen.getByRole("img").getAttribute("src")).toBe("/b-full.webp");
  });
});
