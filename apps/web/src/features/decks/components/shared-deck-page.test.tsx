import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ user: null as { id: string } | null }));

vi.mock("@tanstack/react-router", () => ({
  getRouteApi: () => ({ useParams: () => ({ token: "token-1" }) }),
  useNavigate: () => vi.fn(),
  useLocation: ({ select }: { select: (location: { href: string }) => string }) =>
    select({ href: "/decks/share/token-1" }),
  Link: ({
    children,
    to,
    search,
  }: {
    children: ReactNode;
    to: string;
    search: { redirect?: string };
  }) => <a href={`${to}?redirect=${search.redirect ?? ""}`}>{children}</a>,
}));

vi.mock("@/features/decks/hooks/use-decks", () => ({
  usePublicDeck: () => ({ data: { deck: { id: "deck-1", name: "Deck" }, owner: {}, cards: [] } }),
  useCloneSharedDeck: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ data: { user: session.user } }),
}));

vi.mock("@/features/decks/components/public-deck-surface", () => ({
  PublicDeckSurface: ({ heroActions }: { heroActions: ReactNode }) => <div>{heroActions}</div>,
}));

vi.mock("@/features/decks/components/public-deck-actions-menu", () => ({
  PublicDeckActionsMenu: () => null,
}));

const { SharedDeckPage } = await import("./shared-deck-page");

describe("SharedDeckPage", () => {
  it("offers a signed-out visitor sign-in and account creation that return to the deck", () => {
    session.user = null;
    render(<SharedDeckPage />);
    expect(screen.getByRole("link", { name: "Sign in to copy" }).getAttribute("href")).toBe(
      "/login?redirect=/decks/share/token-1",
    );
    expect(screen.getByRole("link", { name: "Create an account" }).getAttribute("href")).toBe(
      "/signup?redirect=/decks/share/token-1",
    );
  });

  it("offers a signed-in viewer the copy", () => {
    session.user = { id: "user-1" };
    render(<SharedDeckPage />);
    expect(screen.getByRole("button", { name: "Add to my decks" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Create an account" })).toBeNull();
  });
});
