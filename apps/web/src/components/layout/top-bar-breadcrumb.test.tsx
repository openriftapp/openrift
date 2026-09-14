import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TopBarBreadcrumbTrail } from "./top-bar-breadcrumb";

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
