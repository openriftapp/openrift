import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MetaArchiveCounts } from "./meta-archive-counts";

describe("MetaArchiveCounts", () => {
  it("hides zero tiles", () => {
    render(<MetaArchiveCounts eventCount={7} playerResultCount={0} deckCount={0} />);
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.queryByText("0")).toBeNull();
  });

  it("hides a zero tile even when other results exist", () => {
    render(<MetaArchiveCounts eventCount={7} playerResultCount={40} deckCount={0} />);
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.queryByText("0")).toBeNull();
  });

  it("renders no row when every tile is zero", () => {
    const { container } = render(
      <MetaArchiveCounts eventCount={0} playerResultCount={0} deckCount={0} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
