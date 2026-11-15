import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Swap } from "./vignette-parts";

describe("Swap", () => {
  it("keeps the finished state visible when nothing animates", () => {
    render(<Swap was="before" now="after" />);

    expect(screen.getByText("after").className).not.toContain("opacity-0");
    expect(screen.getByText("before").className).toContain("opacity-0");
  });

  it("runs each layer on the animation the caller times it with", () => {
    render(
      <Swap
        was="before"
        now="after"
        wasAnimation="motion-safe:animate-box-before"
        nowAnimation="motion-safe:animate-box-after"
      />,
    );

    expect(screen.getByText("before").className).toContain("motion-safe:animate-box-before");
    expect(screen.getByText("after").className).toContain("motion-safe:animate-box-after");
  });

  it("gives both layers the shared layer class", () => {
    render(<Swap was="before" now="after" layerClassName="truncate" />);

    expect(screen.getByText("before").className).toContain("truncate");
    expect(screen.getByText("after").className).toContain("truncate");
  });
});
