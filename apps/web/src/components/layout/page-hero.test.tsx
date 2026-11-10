import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHero, PageHeroStats } from "./page-hero";

function ornament(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-slot="ornament-rule"]') as HTMLElement;
}

describe("PageHero", () => {
  it("keeps the full head on every width by default", () => {
    const { container } = render(
      <PageHero
        eyebrow="Tournament results"
        title="Meta Archive"
        lead="Results from Summoner Skirmish."
      />,
    );

    expect(screen.getByRole("heading", { level: 1 }).className).toContain("text-4xl");
    expect(screen.getByRole("heading", { level: 1 }).className).toContain("md:text-5xl");
    expect(screen.getByText("Tournament results").className).not.toContain("max-md:hidden");
    expect(screen.getByText("Results from Summoner Skirmish.").className).not.toContain(
      "max-md:hidden",
    );
    expect(ornament(container).className).not.toContain("max-md:hidden");
  });

  it("ignores phone facts unless the page opts into the compact phone head", () => {
    render(<PageHero title="Meta Archive" phoneFacts={["Results through Oct 9, 2026"]} />);

    expect(screen.queryByText("Results through Oct 9, 2026")).toBeNull();
  });

  it("shrinks the title and hides the eyebrow, ornament and lead below md when compact", () => {
    const { container } = render(
      <PageHero
        eyebrow="Tournament results"
        title="Meta Archive"
        lead="Results from Summoner Skirmish."
        compactOnPhone
      />,
    );

    const title = screen.getByRole("heading", { level: 1 });
    expect(title.className).toContain("text-2xl");
    expect(title.className).toContain("md:text-5xl");
    expect(title.className).not.toContain("md:text-4xl");
    expect(screen.getByText("Tournament results").className).toContain("max-md:hidden");
    expect(screen.getByText("Results from Summoner Skirmish.").className).toContain(
      "max-md:hidden",
    );
    expect(ornament(container).className).toContain("max-md:hidden");
  });

  it("keeps the desktop title step of a compact title", () => {
    render(<PageHero title="Contribute" compactTitle compactOnPhone />);

    const title = screen.getByRole("heading", { level: 1 });
    expect(title.className).toContain("text-2xl");
    expect(title.className).toContain("md:text-4xl");
    expect(title.className).not.toContain("md:text-5xl");
  });

  it("joins the phone facts into one line shown only below md", () => {
    render(
      <PageHero
        title="Core Rules"
        compactOnPhone
        phoneFacts={["Version 1.5", "Published Oct 9, 2026", "4 languages"]}
      />,
    );

    const facts = screen.getByText("Version 1.5 · Published Oct 9, 2026 · 4 languages");
    expect(facts.classList.contains("md:hidden")).toBe(true);
    expect(facts.classList.contains("max-md:hidden")).toBe(false);
  });

  it("renders no facts line when there are no facts", () => {
    const { container } = render(<PageHero title="Core Rules" compactOnPhone phoneFacts={[]} />);

    expect(container.querySelector("p")).toBeNull();
  });
});

describe("PageHeroStats", () => {
  it("passes a class through to the list", () => {
    const { container } = render(
      <PageHeroStats
        stats={[{ key: "version", label: "version", value: "1.5" }]}
        className="max-md:hidden"
      />,
    );

    expect(container.querySelector("dl")?.className).toContain("max-md:hidden");
  });
});
