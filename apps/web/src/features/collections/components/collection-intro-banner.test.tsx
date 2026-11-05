import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string; params?: { slug?: string } }) => (
    <a href={to?.replace("$slug", params?.slug ?? "")} {...rest}>
      {children}
    </a>
  ),
}));

const { CollectionIntroBanner } = await import("./collection-intro-banner");

describe("CollectionIntroBanner", () => {
  it("points the owned view at the library toggle", () => {
    render(<CollectionIntroBanner showLibrary={false} onDismiss={() => {}} />);

    expect(screen.getByText("Turn on the library to browse and add every card.")).toBeVisible();
  });

  it("explains adding while the library is on", () => {
    render(<CollectionIntroBanner showLibrary onDismiss={() => {}} />);

    expect(screen.getByText("Tap the + on any card to add it to your collection.")).toBeVisible();
  });

  it("links to the collections help article", () => {
    render(<CollectionIntroBanner showLibrary={false} onDismiss={() => {}} />);

    expect(screen.getByRole("link", { name: "How it works" })).toHaveAttribute(
      "href",
      "/help/collections",
    );
  });

  it("calls onDismiss from the close button", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<CollectionIntroBanner showLibrary={false} onDismiss={onDismiss} />);

    await user.click(screen.getByRole("button", { name: "Dismiss this guide" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
