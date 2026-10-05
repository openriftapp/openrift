import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TopBarBreadcrumbBar, TopBarBreadcrumbTrail } from "./top-bar-breadcrumb";

vi.mock("@/paraglide/messages.js", () => ({
  m: { layout_breadcrumb_back: ({ label }: { label: string }) => `Back to ${label}` },
}));

describe("TopBarBreadcrumbTrail", () => {
  it("renders an unlinked last segment as the page title", () => {
    render(
      <TopBarBreadcrumbTrail
        segments={[
          { label: "Archive", link: <a href="/meta">Archive</a> },
          { label: "Summoner Skirmish" },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Summoner Skirmish" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Archive" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Archive" })).toBeInTheDocument();
  });

  it("keeps a linked last segment inside the trail without a title", () => {
    render(
      <TopBarBreadcrumbTrail
        segments={[
          { label: "Archive", link: <a href="/meta">Archive</a> },
          { label: "Summoner Skirmish", link: <a href="/meta/skirmish">Summoner Skirmish</a> },
        ]}
      />,
    );
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByRole("link", { name: "Back to Summoner Skirmish" })).toBeInTheDocument();
  });
});

describe("TopBarBreadcrumbBar", () => {
  const segments = [
    { label: "Tournaments", link: <a href="/tournaments">Tournaments</a> },
    { label: "Summoner Skirmish", link: <a href="/tournaments/1">Summoner Skirmish</a> },
  ];

  it("renders the title after the linked trail", () => {
    render(<TopBarBreadcrumbBar segments={segments} title="Pairings" />);
    expect(screen.getByRole("heading", { name: "Pairings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tournaments" })).toBeInTheDocument();
    expect(screen.getByText("/", { selector: "span.hidden" })).toBeInTheDocument();
  });

  it("renders no title without one", () => {
    render(<TopBarBreadcrumbBar segments={segments} />);
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("publishes the bar height to the content below as --sticky-top", () => {
    render(
      <TopBarBreadcrumbBar segments={segments} title="Pairings">
        <p>Round 1</p>
      </TopBarBreadcrumbBar>,
    );
    const wrapper = screen.getByText("Round 1").parentElement;
    expect(wrapper).toHaveClass("contents");
    expect(wrapper?.style.getPropertyValue("--sticky-top")).toBe(
      "calc(var(--header-height) + 0px + 1rem)",
    );
  });

  it("adds no content wrapper without children", () => {
    const { container } = render(<TopBarBreadcrumbBar segments={segments} />);
    expect(container.querySelector(".contents")).toBeNull();
  });
});
