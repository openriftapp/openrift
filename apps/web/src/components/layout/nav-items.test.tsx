import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  useLocation: (opts?: { select?: (location: { href: string }) => unknown }) => {
    const location = { href: "/cards" };
    return opts?.select ? opts.select(location) : location;
  },
  Link: ({ children, to, ...rest }: { children: ReactNode; to: string }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

const { paletteNavItems, SignInRequiredDialog } = await import("./nav-items");

const ALL_ON = { glossary: true, "board-states": true, scanner: true };

function destinations(items: readonly { to: string }[]): string[] {
  return items.map((item) => item.to);
}

describe("paletteNavItems", () => {
  it("hides on a phone what the phone menu hides", () => {
    const paths = destinations(paletteNavItems({ flags: ALL_ON, mobile: true }));
    expect(paths).not.toContain("/stage");
    expect(paths).not.toContain("/tier-lists");
    expect(paths).toContain("/cards");
  });

  it("lists the desktop tools on a desktop", () => {
    const paths = destinations(paletteNavItems({ flags: ALL_ON, mobile: false }));
    expect(paths).toContain("/stage");
    expect(paths).toContain("/tier-lists");
  });

  it("drops destinations whose flag is off", () => {
    const paths = destinations(
      paletteNavItems({ flags: { ...ALL_ON, scanner: false }, mobile: true }),
    );
    expect(paths).not.toContain("/scan");
  });
});

describe("SignInRequiredDialog", () => {
  it("lays the two links straight into the footer so a phone stacks them, sign-up on top", async () => {
    render(<SignInRequiredDialog featureKey="collections" onOpenChange={() => {}} />);
    const signUp = await screen.findByRole("link", { name: "Sign up" });
    const signIn = screen.getByRole("link", { name: "Sign in" });
    const footer = signUp.closest("[data-slot=dialog-footer]");
    expect(footer).toHaveClass("flex-col-reverse");
    expect(signUp.parentElement).toHaveClass("contents");
    expect(signIn.compareDocumentPosition(signUp) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
