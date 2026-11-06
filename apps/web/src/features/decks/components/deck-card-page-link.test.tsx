import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CardPageHrefContext, DeckCardPageLink } from "./deck-card-page-link";

function renderLink(onParentClick: () => void, resolve = () => "/cards/en-garde") {
  render(
    <CardPageHrefContext value={resolve}>
      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- stands in for the thumb's click handler */}
      <div onClick={onParentClick}>
        <DeckCardPageLink cardId="card-1" printingId="printing-1">
          En Garde
        </DeckCardPageLink>
      </div>
    </CardPageHrefContext>,
  );
}

describe("DeckCardPageLink", () => {
  it("links to the card page", () => {
    renderLink(vi.fn());
    expect(screen.getByRole("link", { name: "En Garde" }).getAttribute("href")).toBe(
      "/cards/en-garde",
    );
  });

  it("hands a plain click to the surrounding handler without navigating", () => {
    const onParentClick = vi.fn();
    renderLink(onParentClick);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    screen.getByRole("link", { name: "En Garde" }).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(onParentClick).toHaveBeenCalledOnce();
  });

  it("keeps a modified click for the browser", () => {
    const onParentClick = vi.fn();
    renderLink(onParentClick);
    fireEvent.click(screen.getByRole("link", { name: "En Garde" }), { ctrlKey: true });
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it("renders plain content when no card page resolves", () => {
    renderLink(vi.fn(), () => undefined as unknown as string);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("En Garde")).toBeDefined();
  });
});
