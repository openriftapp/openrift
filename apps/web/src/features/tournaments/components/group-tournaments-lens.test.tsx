import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/features/tournaments/hooks/use-tournaments", () => ({
  useGroupTournaments: () => ({ data: { items: [] } }),
}));

const { GroupTournamentsLens } = await import("./group-tournaments-lens");

describe("GroupTournamentsLens", () => {
  it("renders the create action as a link, not a button", () => {
    render(<GroupTournamentsLens slug="g" groupId="id" canCreate />);
    expect(screen.getByRole("link", { name: /new tournament/iu })).toHaveAttribute(
      "href",
      "/tournaments/new",
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});
