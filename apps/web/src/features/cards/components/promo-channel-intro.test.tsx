import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PromoChannelIntro } from "./promo-channel-intro";

const QUOTE = "Bring a friend to Summoner Skirmish and both of you leave with a pack.";
const DESCRIPTION = `Announced [2025-10-06](https://example.com/news/a). "${QUOTE}" Also handed out at events.`;

function stubLayout(scrollHeight: number, clientHeight: number) {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(scrollHeight);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(clientHeight);
}

describe("PromoChannelIntro", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the announcement date, link, quote and note", () => {
    stubLayout(40, 40);
    render(<PromoChannelIntro description={DESCRIPTION} />);

    expect(screen.getByText(/Announced Oct 6, 2025/u)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Announcement" })).toHaveAttribute(
      "href",
      "https://example.com/news/a",
    );
    expect(screen.getByText(QUOTE)).toBeInTheDocument();
    expect(screen.getByText("Also handed out at events.")).toBeInTheDocument();
  });

  it("offers no toggle when the quote fits in two lines", () => {
    stubLayout(40, 40);
    render(<PromoChannelIntro description={DESCRIPTION} />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(QUOTE)).toHaveClass("line-clamp-2");
  });

  it("clamps a long quote and toggles it open and closed", async () => {
    const user = userEvent.setup();
    stubLayout(120, 40);
    render(<PromoChannelIntro description={DESCRIPTION} />);

    const quote = screen.getByText(QUOTE);
    const readMore = screen.getByRole("button", { name: "Read more" });
    expect(quote).toHaveClass("line-clamp-2");
    expect(readMore).toHaveAttribute("aria-expanded", "false");

    await user.click(readMore);
    const showLess = screen.getByRole("button", { name: "Show less" });
    expect(quote).not.toHaveClass("line-clamp-2");
    expect(showLess).toHaveAttribute("aria-expanded", "true");

    await user.click(showLess);
    expect(quote).toHaveClass("line-clamp-2");
    expect(screen.getByRole("button", { name: "Read more" })).toBeInTheDocument();
  });

  it("renders plain text without the announcement lead-in as a note", () => {
    stubLayout(40, 40);
    render(<PromoChannelIntro description="Handed out at Summoner Skirmish events." />);

    expect(screen.getByText("Handed out at Summoner Skirmish events.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
