// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { ImgWithFallback } from "./img-with-fallback";

describe("ImgWithFallback", () => {
  it("renders the image until it errors, then the fallback", () => {
    const { container } = render(
      <ImgWithFallback
        src="/media/cards/aa/broken-400w.webp"
        alt="Broken Card"
        fallback={<div data-testid="fallback" />}
      />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(container.querySelector('[data-testid="fallback"]')).toBeNull();

    if (!img) {
      throw new Error("img not found");
    }
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[data-testid="fallback"]')).not.toBeNull();
  });

  it("renders nothing after an error when the fallback is null", () => {
    const { container } = render(
      <ImgWithFallback src="/media/cards/aa/broken-400w.webp" alt="" fallback={null} />,
    );
    const img = container.querySelector("img");
    if (!img) {
      throw new Error("img not found");
    }
    fireEvent.error(img);
    expect(container.firstChild).toBeNull();
  });

  it("retries a new src after a previous one failed", () => {
    const { container, rerender } = render(
      <ImgWithFallback src="/media/a.webp" alt="" fallback={null} />,
    );
    const img = container.querySelector("img");
    if (!img) {
      throw new Error("img not found");
    }
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();

    rerender(<ImgWithFallback src="/media/b.webp" alt="" fallback={null} />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/media/b.webp");
  });

  it.each([undefined, ""])("renders the fallback without an image for a src of %o", (src) => {
    const { container } = render(
      <ImgWithFallback src={src} alt="" fallback={<div data-testid="fallback" />} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[data-testid="fallback"]')).not.toBeNull();
  });

  it("hands the image element to an object ref", () => {
    const ref = createRef<HTMLImageElement>();
    const { container } = render(
      <ImgWithFallback ref={ref} src="/media/a.webp" alt="" fallback={null} />,
    );
    expect(ref.current).toBe(container.querySelector("img"));
  });

  it("hands the image element to a callback ref", () => {
    const ref = vi.fn();
    const { container } = render(
      <ImgWithFallback ref={ref} src="/media/a.webp" alt="" fallback={null} />,
    );
    expect(ref).toHaveBeenCalledWith(container.querySelector("img"));
  });

  it("calls the caller's onError after switching to the fallback", () => {
    const onError = vi.fn();
    const { container } = render(
      <ImgWithFallback
        src="/media/cards/aa/broken-400w.webp"
        alt=""
        onError={onError}
        fallback={<div data-testid="fallback" />}
      />,
    );
    const img = container.querySelector("img");
    if (!img) {
      throw new Error("img not found");
    }
    fireEvent.error(img);
    expect(onError).toHaveBeenCalledOnce();
    expect(container.querySelector('[data-testid="fallback"]')).not.toBeNull();
  });
});
