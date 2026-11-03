import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePrintingsHostState } from "./printings-host";

function Host({ expand }: { expand: boolean }) {
  const { host, slotRef } = usePrintingsHostState();
  return (
    <div>
      <button type="button" onClick={() => host.setExpanded(expand)}>
        toggle
      </button>
      <div ref={slotRef} />
    </div>
  );
}

const originalScrollTo = HTMLElement.prototype.scrollTo;

afterEach(() => {
  HTMLElement.prototype.scrollTo = originalScrollTo;
});

describe("usePrintingsHostState", () => {
  it("scrolls the slot's parent to the top when it expands", async () => {
    const scrollTo = vi.fn();
    HTMLElement.prototype.scrollTo = scrollTo;
    render(<Host expand />);

    expect(scrollTo).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "toggle" }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
  });

  it("scrolls the given scroller instead when there is one", async () => {
    const scrollTo = vi.fn();
    HTMLElement.prototype.scrollTo = scrollTo;
    function WithScroller() {
      const scrollerRef = useRef<HTMLDivElement>(null);
      const { host, slotRef } = usePrintingsHostState(scrollerRef);
      return (
        <div>
          <div ref={scrollerRef} data-testid="scroller" />
          <button type="button" onClick={() => host.setExpanded(true)}>
            toggle
          </button>
          <div ref={slotRef} />
        </div>
      );
    }
    render(<WithScroller />);

    await userEvent.click(screen.getByRole("button", { name: "toggle" }));

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo.mock.contexts[0]).toBe(screen.getByTestId("scroller"));
  });

  it("leaves the scroll position alone while it stays shrunk", async () => {
    const scrollTo = vi.fn();
    HTMLElement.prototype.scrollTo = scrollTo;
    render(<Host expand={false} />);

    await userEvent.click(screen.getByRole("button", { name: "toggle" }));

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
