import { createEvent, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useCardHoverPreview } from "./rule-card-preview";

const IMAGE_ID = "019a0000-0000-7000-8000-0000000000ab";

function Harness() {
  const preview = useCardHoverPreview("[data-board-preview]");
  return (
    <div
      data-testid="host"
      onPointerOver={preview.handlePointerOver}
      onPointerOut={preview.handlePointerOut}
      onPointerDown={preview.handlePointerDown}
    >
      <span data-testid="card" data-board-preview="" data-card-image={IMAGE_ID}>
        <span data-testid="inner" />
      </span>
      <span
        data-testid="landscape"
        data-board-preview=""
        data-card-image={IMAGE_ID}
        data-card-landscape=""
      />
      <span data-testid="plain" data-card-image={IMAGE_ID} />
      {preview.preview}
    </div>
  );
}

function pointer(
  type: "pointerOver" | "pointerOut",
  target: Element,
  init: { pointerType?: string; buttons?: number; relatedTarget?: Element | null } = {},
) {
  const event = createEvent[type](target, { bubbles: true, ...init });
  Object.defineProperty(event, "pointerType", { value: init.pointerType ?? "mouse" });
  Object.defineProperty(event, "buttons", { value: init.buttons ?? 0 });
  fireEvent(target, event);
}

function previewImages() {
  return document.body.querySelectorAll(`img[src*="${IMAGE_ID}"]`);
}

describe("useCardHoverPreview", () => {
  it("shows the large image when a matching element is hovered", () => {
    const { getByTestId } = render(<Harness />);
    pointer("pointerOver", getByTestId("inner"));
    const sources = [...previewImages()].map((image) => image.getAttribute("src"));
    expect(sources).toEqual([
      expect.stringContaining(`${IMAGE_ID}-400w`),
      expect.stringContaining(`${IMAGE_ID}-full`),
    ]);
  });

  it("sizes a landscape card wide", () => {
    const { getByTestId } = render(<Harness />);
    pointer("pointerOver", getByTestId("landscape"));
    expect(document.body.querySelector(String.raw`.w-\[560px\]`)).not.toBeNull();
  });

  it("ignores elements outside the selector", () => {
    const { getByTestId } = render(<Harness />);
    pointer("pointerOver", getByTestId("plain"));
    expect(previewImages()).toHaveLength(0);
  });

  it("ignores touch and pressed-button hovers", () => {
    const { getByTestId } = render(<Harness />);
    pointer("pointerOver", getByTestId("card"), { pointerType: "touch" });
    pointer("pointerOver", getByTestId("card"), { buttons: 1 });
    expect(previewImages()).toHaveLength(0);
  });

  it("stays while the pointer moves inside the card and hides when it leaves", () => {
    const { getByTestId } = render(<Harness />);
    const card = getByTestId("card");
    pointer("pointerOver", card);
    pointer("pointerOut", card, { relatedTarget: getByTestId("inner") });
    expect(previewImages()).not.toHaveLength(0);
    pointer("pointerOut", card, { relatedTarget: getByTestId("host") });
    expect(previewImages()).toHaveLength(0);
  });

  it("hides on pointer down", () => {
    const { getByTestId } = render(<Harness />);
    pointer("pointerOver", getByTestId("card"));
    fireEvent.pointerDown(getByTestId("card"));
    expect(previewImages()).toHaveLength(0);
  });
});
