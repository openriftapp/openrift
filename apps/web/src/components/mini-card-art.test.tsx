// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MiniCardArt } from "./mini-card-art";

describe("MiniCardArt", () => {
  it("shows the art while it loads", () => {
    const { container } = render(<MiniCardArt url="/media/cards/aa/card-240w.webp" />);

    expect(container.querySelector("img")).not.toBeNull();
  });

  it("shows the empty card frame once the art fails to load", () => {
    const { container } = render(<MiniCardArt url="/media/cards/aa/broken-240w.webp" />);
    const img = container.querySelector("img");
    if (!img) {
      throw new Error("img not found");
    }

    fireEvent.error(img);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".bg-muted.aspect-card")).not.toBeNull();
  });
});
