// @vitest-environment jsdom
import type { PrintingOtherSide } from "@openrift/shared/types/catalog";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DoubleSidedFlip } from "./double-sided-flip";

const reducedMotion = vi.hoisted(() => ({ value: false }));
vi.mock("@/hooks/use-reduced-motion", () => ({ useReducedMotion: () => reducedMotion.value }));

const otherSide: PrintingOtherSide = {
  faceId: "face-2",
  cardId: "card-2",
  cardName: "Recruit",
  cardSlug: "recruit",
  shortCode: "OGN-T02",
  imageId: "019d6c25-b081-74b3-a901-64da4ae0abcd",
};

function renderFlip(side: PrintingOtherSide = otherSide) {
  const onFlip = vi.fn();
  render(
    <DoubleSidedFlip otherSide={side} onFlip={onFlip}>
      <span>Buff</span>
    </DoubleSidedFlip>,
  );
  return { onFlip, flipper: screen.getByTestId("double-sided-flipper") };
}

afterEach(() => {
  reducedMotion.value = false;
});

describe("DoubleSidedFlip", () => {
  it("labels the pill with the other side's name", () => {
    renderFlip();
    expect(screen.getByRole("button", { name: "Flip to Recruit" }).textContent).toBe("Recruit");
  });

  it("turns the card and switches sides once the transform transition ends", () => {
    const { onFlip, flipper } = renderFlip();
    fireEvent.click(screen.getByRole("button", { name: "Flip to Recruit" }));
    expect(flipper.className).toContain("rotate-y-180");
    expect(onFlip).not.toHaveBeenCalled();

    fireEvent.transitionEnd(flipper, { propertyName: "opacity" });
    expect(onFlip).not.toHaveBeenCalled();

    fireEvent.transitionEnd(flipper, { propertyName: "transform" });
    expect(onFlip).toHaveBeenCalledTimes(1);
  });

  it("ignores transition ends that bubble up from the card face", () => {
    const { onFlip } = renderFlip();
    fireEvent.click(screen.getByRole("button", { name: "Flip to Recruit" }));
    fireEvent.transitionEnd(screen.getByText("Buff"), { propertyName: "transform" });
    expect(onFlip).not.toHaveBeenCalled();
  });

  it("leaves modified clicks to the browser", () => {
    const { onFlip, flipper } = renderFlip();
    fireEvent.click(screen.getByRole("button", { name: "Flip to Recruit" }), { ctrlKey: true });
    expect(flipper.className).not.toContain("rotate-y-180");
    expect(onFlip).not.toHaveBeenCalled();
  });

  it("switches sides at once when reduced motion is preferred", () => {
    reducedMotion.value = true;
    const { onFlip, flipper } = renderFlip();
    fireEvent.click(screen.getByRole("button", { name: "Flip to Recruit" }));
    expect(onFlip).toHaveBeenCalledTimes(1);
    expect(flipper.className).not.toContain("rotate-y-180");
  });

  it("holds a plain click on a link pill for the flip and passes modified clicks through", () => {
    const onFlip = vi.fn();
    render(
      <DoubleSidedFlip
        otherSide={otherSide}
        onFlip={onFlip}
        renderLink={({ children, ...pill }) => (
          <a href="/cards/recruit" {...pill}>
            {children}
          </a>
        )}
      >
        <span>Buff</span>
      </DoubleSidedFlip>,
    );
    const pill = screen.getByRole("link", { name: "Flip to Recruit" });
    expect(fireEvent.click(pill, { ctrlKey: true })).toBe(true);
    expect(fireEvent.click(pill)).toBe(false);
    expect(screen.getByTestId("double-sided-flipper").className).toContain("rotate-y-180");
  });

  it("switches sides at once when the other side has no image", () => {
    const { onFlip } = renderFlip({ ...otherSide, imageId: undefined });
    fireEvent.click(screen.getByRole("button", { name: "Flip to Recruit" }));
    expect(onFlip).toHaveBeenCalledTimes(1);
  });
});
