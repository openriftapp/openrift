import { DEVELOPERS_SHOWCASE } from "@openrift/shared/developers-showcase";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { DevelopersPage } from "./developers-page";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  Link: ({ children }: { children?: ReactNode }) => <a href="/">{children}</a>,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useQuery: () => ({
    data: {
      card: {
        name: "Bounty Hunter",
        types: ["legend"],
        tags: ["Miss Fortune"],
        energy: null,
        domains: ["body", "order"],
      },
      printings: [
        {
          publicCode: DEVELOPERS_SHOWCASE.publicCode,
          language: "EN",
          printedRulesText: null,
          images: [],
        },
      ],
    },
  }),
}));

describe("DevelopersPage", () => {
  it("shows the showcase card under its display name", () => {
    render(<DevelopersPage />);

    expect(screen.getByText('"Miss Fortune, Bounty Hunter"')).toBeTruthy();
  });
});
