import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ userId: null as string | null }));
const trackSignupCta = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-session", () => ({ useUserId: () => session.userId }));
vi.mock("@/lib/analytics", () => ({ trackSignupCta }));
vi.mock("@/features/marketing/components/hero-cta", () => ({
  HeroCta: ({
    to,
    children,
    onClick,
    rel,
  }: {
    to: string;
    children?: ReactNode;
    onClick?: () => void;
    rel?: string;
  }) => (
    <a href={to} rel={rel} onClick={onClick}>
      {children}
    </a>
  ),
}));

const { HeroCtas } = await import("./hero-ctas");

beforeEach(() => {
  session.userId = null;
  trackSignupCta.mockClear();
});

describe("HeroCtas", () => {
  it("offers a signed-out visitor the signup link and tracks where it was pressed", () => {
    render(<HeroCtas source="home-closing" />);

    const signup = screen.getByRole("link", { name: "Sign up free" });
    expect(signup).toHaveAttribute("href", "/signup");
    expect(signup).toHaveAttribute("rel", "nofollow");
    fireEvent.click(signup);
    expect(trackSignupCta).toHaveBeenCalledWith("home-closing");
  });

  it("leaves the signup link out for a signed-in viewer", () => {
    session.userId = "user-1";
    render(<HeroCtas source="home-hero" />);

    expect(screen.queryByRole("link", { name: "Sign up free" })).toBeNull();
    expect(screen.getByRole("link", { name: "Browse cards" })).toBeInTheDocument();
  });
});
