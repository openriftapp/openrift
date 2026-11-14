import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const flags = vi.hoisted(() => ({ scanner: true }));

function MockLink({ to, children }: { to?: string; children?: ReactNode }) {
  return <a href={to}>{children}</a>;
}

vi.mock("@tanstack/react-router", () => ({ Link: MockLink, createLink: () => MockLink }));
vi.mock("@/hooks/use-feature-flags", () => ({ useFeatureEnabled: () => flags.scanner }));
vi.mock("@/hooks/use-session", () => ({ useUserId: () => null }));

const { LandingClosing } = await import("./landing-closing");

describe("LandingClosing", () => {
  it("lists the scanner in the chapter tiles while the scanner is on", () => {
    flags.scanner = true;
    render(<LandingClosing />);

    expect(screen.getByText(/Scanner/u)).toBeInTheDocument();
  });

  it("leaves the scanner out of the chapter tiles while the scanner is off", () => {
    flags.scanner = false;
    render(<LandingClosing />);

    expect(screen.queryByText(/Scanner/u)).toBeNull();
    expect(screen.getAllByRole("navigation").length).toBeGreaterThan(0);
  });
});
