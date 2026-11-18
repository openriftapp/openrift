// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const retry = vi.fn();
let failed = false;

vi.mock("@/features/meta/hooks/use-meta-overlay-failure", () => ({
  useMetaOverlayFailure: () => ({ failed, retry }),
}));

import { MetaOverlayNote } from "./meta-overlay-note";

describe("MetaOverlayNote", () => {
  beforeEach(() => {
    failed = false;
    retry.mockClear();
  });

  it("renders nothing while the overlays load or have loaded", () => {
    const { container } = render(<MetaOverlayNote decks={{}} enabled withPrices />);
    expect(container).toBeEmptyDOMElement();
  });

  it("says what failed and retries on request", () => {
    failed = true;
    render(<MetaOverlayNote decks={{}} enabled withPrices />);
    expect(screen.getByRole("status")).toHaveTextContent("Some deck details couldn't load.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
