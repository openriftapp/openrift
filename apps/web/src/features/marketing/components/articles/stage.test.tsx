import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { resolvePresentationKey } from "@/features/stage/lib/presentation-keys";

import StageArticle from "./stage";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => <a href="/stage">{children}</a>,
}));

const SHOWN_AS: Record<string, string> = {
  ArrowRight: "→",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowUp: "↑",
  " ": "Space",
  PageDown: "PgDn",
  PageUp: "PgUp",
  Escape: "Esc",
};

const PROBED_KEYS = [...Object.keys(SHOWN_AS), "Home", "End", "?", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

describe("StageArticle key table", () => {
  it("lists every key the show responds to", () => {
    const { container } = render(<StageArticle />);
    const listed = new Set(
      [...container.querySelectorAll("[data-slot=kbd]")].map((node) => node.textContent),
    );

    const handled = PROBED_KEYS.filter((key) => resolvePresentationKey({ key }) !== null).map(
      (key) => SHOWN_AS[key] ?? key,
    );

    expect(handled.filter((key) => !listed.has(key))).toEqual([]);
  });
});
