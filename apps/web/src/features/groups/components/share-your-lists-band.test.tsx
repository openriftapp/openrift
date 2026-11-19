import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const lists = vi.hoisted(() => ({
  items: [] as { listIntent: string; sharedAt: string | null }[],
}));

vi.mock("@/features/groups/hooks/use-friend-group-sharing", () => ({
  useFriendGroupShareableLists: () => ({ data: { items: lists.items } }),
}));
vi.mock("./share-lists-with-group-dialog", () => ({ ShareListsWithGroupDialog: () => null }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => <a href="/collections">{children}</a>,
}));

const { ShareYourListsBand } = await import("./share-your-lists-band");

afterEach(() => {
  lists.items = [];
});

describe("ShareYourListsBand", () => {
  it("stays out of the way once every list is shared", () => {
    lists.items = [
      { listIntent: "wish", sharedAt: "2026-11-01T10:00:00.000Z" },
      { listIntent: "trade", sharedAt: "2026-11-01T10:00:00.000Z" },
    ];
    const { container } = render(<ShareYourListsBand slug="skirmish" groupName="Skirmish" />);
    expect(container.textContent).toBe("");
  });

  it("offers to share the lists that are not shared yet", () => {
    lists.items = [
      { listIntent: "wish", sharedAt: "2026-11-01T10:00:00.000Z" },
      { listIntent: "trade", sharedAt: null },
    ];
    render(<ShareYourListsBand slug="skirmish" groupName="Skirmish" />);
    expect(screen.getByText("You've shared 1 of 2 lists with this group")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Share more" })).toBeTruthy();
  });

  it("points to creating a list when there is none", () => {
    render(<ShareYourListsBand slug="skirmish" groupName="Skirmish" />);
    expect(screen.getByText("Create one")).toBeTruthy();
  });
});
