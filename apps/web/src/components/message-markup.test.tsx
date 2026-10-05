import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { linkMarkup, PROSE_MARKUP } from "./message-markup";

describe("PROSE_MARKUP", () => {
  it("renders strong in the foreground color", () => {
    const Strong = PROSE_MARKUP.strong;
    render(<Strong>Summoner Skirmish</Strong>);
    const el = screen.getByText("Summoner Skirmish");
    expect(el.tagName).toBe("STRONG");
    expect(el).toHaveClass("text-foreground");
  });

  it("renders em as emphasis", () => {
    const Em = PROSE_MARKUP.em;
    render(<Em>once</Em>);
    expect(screen.getByText("once").tagName).toBe("EM");
  });

  it("renders code through the Code chip", () => {
    const CodeMarkup = PROSE_MARKUP.code;
    render(<CodeMarkup>!card</CodeMarkup>);
    expect(screen.getByText("!card")).toHaveAttribute("data-slot", "code");
  });
});

describe("linkMarkup", () => {
  it("links the wrapped text to the href", () => {
    const Link = linkMarkup("/help/groups");
    render(<Link>groups</Link>);
    expect(screen.getByRole("link", { name: "groups" })).toHaveAttribute("href", "/help/groups");
  });
});
