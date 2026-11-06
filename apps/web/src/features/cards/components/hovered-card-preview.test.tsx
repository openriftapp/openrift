import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HoveredCardPreview } from "./hovered-card-preview";

const card = { thumbnailUrl: "/thumb.webp", fullUrl: "/full.webp", landscape: false };

function rect(left: number, width: number): DOMRect {
  return {
    left,
    top: 0,
    width,
    height: 800,
    right: left + width,
    bottom: 800,
    x: left,
    y: 0,
    toJSON: () => ({}),
  };
}

function renderWithAnchor(anchorLeft: number) {
  const container = document.createElement("div");
  container.getBoundingClientRect = () => rect(0, 1600);
  const anchor = document.createElement("aside");
  anchor.dataset.deckPreviewAnchor = "";
  anchor.getBoundingClientRect = () => rect(anchorLeft, 300);
  container.append(anchor);
  document.body.append(container);
  const { container: host } = render(
    <HoveredCardPreview
      hoveredCard={card}
      origin="sidebar"
      containerRef={{ current: container }}
    />,
  );
  const preview = host.firstElementChild as HTMLElement;
  container.remove();
  return preview;
}

describe("HoveredCardPreview", () => {
  beforeEach(() => vi.stubGlobal("innerWidth", 1600));
  afterEach(() => vi.unstubAllGlobals());

  it("opens a sidebar hover just left of a deck column on the right", () => {
    expect(renderWithAnchor(1200).style.left).toBe(`${1200 - 400 - 24}px`);
  });

  it("opens a sidebar hover just right of a deck column on the left", () => {
    expect(renderWithAnchor(0).style.left).toBe(`${300 + 24}px`);
  });
});
