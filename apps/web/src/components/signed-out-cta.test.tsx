import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let currentUserId: string | null = null;
let currentHydrated = true;

vi.mock("@/hooks/use-session", () => ({
  useUserId: () => currentUserId,
}));

vi.mock("@/hooks/use-hydrated", () => ({
  useHydrated: () => currentHydrated,
}));

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ href: "/lists/share/abc123" }),
  Link: ({
    to,
    search,
    children,
    ...rest
  }: {
    to: string;
    search: { redirect?: string };
    children: ReactNode;
  }) => (
    <a href={`${to}?redirect=${search.redirect ?? ""}`} {...rest}>
      {children}
    </a>
  ),
}));

const { PublicShareCta, SignedOutAuthButtons } = await import("./signed-out-cta");

const track = vi.fn();

beforeEach(() => {
  currentUserId = null;
  currentHydrated = true;
  track.mockClear();
  vi.stubGlobal("umami", { track });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SignedOutAuthButtons", () => {
  it("sends both links back to the page the visitor came from", () => {
    render(<SignedOutAuthButtons source="test" />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?redirect=/lists/share/abc123",
    );
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/signup?redirect=/lists/share/abc123",
    );
  });

  it("tracks a click on the sign-up link with its source", () => {
    render(<SignedOutAuthButtons source="group-join" />);
    fireEvent.click(screen.getByRole("link", { name: "Create an account" }));
    expect(track).toHaveBeenCalledWith("signup-cta", { source: "group-join" });
  });

  it("takes a custom sign-in label", () => {
    render(<SignedOutAuthButtons source="test" signInLabel="Sign in to request a spot" />);
    expect(screen.getByRole("link", { name: "Sign in to request a spot" })).toBeInTheDocument();
  });
});

describe("PublicShareCta", () => {
  it("prompts a visitor without an account", () => {
    render(
      <PublicShareCta source="test" title="Keep your own tradelist">
        Show what you have spare.
      </PublicShareCta>,
    );
    expect(screen.getByText("Keep your own tradelist")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create a free account" })).toBeInTheDocument();
  });

  it("records a prompt view for a visitor without an account", () => {
    render(
      <PublicShareCta source="shared-list" title="Keep your own tradelist">
        Show what you have spare.
      </PublicShareCta>,
    );
    expect(track).toHaveBeenCalledWith("signup-prompt-view", { source: "shared-list" });
  });

  it("records no prompt view for a signed-in visitor", () => {
    currentUserId = "user-1";
    render(
      <PublicShareCta source="shared-list" title="Keep your own tradelist">
        Show what you have spare.
      </PublicShareCta>,
    );
    expect(track).not.toHaveBeenCalled();
  });

  it("stays out of the way once someone is signed in", () => {
    currentUserId = "user-1";
    render(
      <PublicShareCta source="test" title="Keep your own tradelist">
        Show what you have spare.
      </PublicShareCta>,
    );
    expect(screen.queryByText("Keep your own tradelist")).not.toBeInTheDocument();
  });

  it("renders nothing before hydration, since the share page is cached for everyone", () => {
    currentHydrated = false;
    render(
      <PublicShareCta source="test" title="Keep your own tradelist">
        Show what you have spare.
      </PublicShareCta>,
    );
    expect(screen.queryByText("Keep your own tradelist")).not.toBeInTheDocument();
  });
});
