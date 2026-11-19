import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children?: ReactNode }) => (
    <a href="/groups" {...props}>
      {children}
    </a>
  ),
}));

const { TradesGroupTitle } = await import("./trades-group-title");

const bothfeld = { slug: "bothfeld", name: "Bothfeld Connection" };
const skirmish = { slug: "skirmish", name: "Summoner Skirmish" };

describe("TradesGroupTitle", () => {
  it("is a plain title without groups", () => {
    render(<TradesGroupTitle groups={[]} groupSlug={null} onGroupChange={vi.fn()} />);
    expect(screen.getByText("Trades")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("names the only group and offers just its page", () => {
    render(<TradesGroupTitle groups={[bothfeld]} groupSlug={null} onGroupChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Bothfeld Connection/u }));
    expect(screen.getByRole("menuitem", { name: "Open Bothfeld Connection" })).toBeTruthy();
    expect(screen.queryByRole("menuitemradio")).toBeNull();
  });

  it("switches between all groups and one group", () => {
    const onGroupChange = vi.fn();
    render(
      <TradesGroupTitle
        groups={[bothfeld, skirmish]}
        groupSlug={null}
        onGroupChange={onGroupChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /all groups/u }));
    expect(screen.queryByRole("menuitem")).toBeNull();
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Summoner Skirmish" }));
    expect(onGroupChange).toHaveBeenCalledWith("skirmish");
  });
});
