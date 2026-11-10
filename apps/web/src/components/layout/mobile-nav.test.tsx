import { render, screen, within } from "@testing-library/react";
import { cloneElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const flags = vi.hoisted(() => ({ showInstall: true, hasNewMilestone: false }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className }: { to: string; children?: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useLocation: ({ select }: { select: (location: { pathname: string }) => unknown }) =>
    select({ pathname: "/cards" }),
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: { open: boolean; children?: ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  SheetContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SheetClose: ({
    render: element,
    className,
    children,
  }: {
    render: ReactElement<{ className?: string; children?: ReactNode }>;
    className?: string;
    children?: ReactNode;
  }) => cloneElement(element, { className, children }),
}));

vi.mock("@/hooks/use-help-menu-flags", () => ({ useHelpMenuFlags: () => flags }));

import { MobileNav } from "./mobile-nav";

const noBadges = { groups: 0, trades: 0, loans: 0 };
const flagsOff = { glossary: false, "board-states": false, scanner: false };

function renderSheet(opts: { isLoggedIn: boolean; onLockedClick?: () => void }) {
  return render(
    <MobileNav
      open
      onOpenChange={() => {}}
      isLoggedIn={opts.isLoggedIn}
      flags={flagsOff}
      badges={noBadges}
      onLockedClick={opts.onLockedClick ?? (() => {})}
    />,
  );
}

function section(name: string): HTMLElement {
  const heading = screen.getByRole("heading", { name });
  const element = heading.closest("section");
  if (!element) {
    throw new Error(`no section for ${name}`);
  }
  return element;
}

beforeEach(() => {
  flags.showInstall = true;
  flags.hasNewMilestone = false;
});

describe("MobileNav", () => {
  it("ends with a Help section after the nav groups, Get the app last", () => {
    renderSheet({ isLoggedIn: true });
    const headings = screen.getAllByRole("heading").map((h) => h.textContent);
    expect(headings.slice(-2)).toEqual(["Help", "Contribute"]);
    const help = within(section("Help"));
    expect(help.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Help articles",
      "What's new",
      "Report a bug",
      "Ask on Discord",
      "Get the app",
    ]);
  });

  it("opens external Help links in a new tab without a referrer", () => {
    renderSheet({ isLoggedIn: true });
    for (const name of ["Report a bug", "Ask on Discord"]) {
      const link = screen.getByRole("link", { name });
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noreferrer");
    }
    expect(screen.getByRole("link", { name: "Help articles" }).getAttribute("target")).toBeNull();
  });

  it("drops the old footer copies of the Discord and install links", () => {
    renderSheet({ isLoggedIn: true });
    expect(screen.queryByText("Join our Discord")).toBeNull();
    expect(screen.getAllByRole("link", { name: "Get the app" })).toHaveLength(1);
  });

  it("hides Get the app inside the installed app", () => {
    flags.showInstall = false;
    renderSheet({ isLoggedIn: true });
    expect(screen.queryByRole("link", { name: "Get the app" })).toBeNull();
  });

  it("links Card data and Support the site for a signed-in visitor", () => {
    renderSheet({ isLoggedIn: true });
    const contribute = within(section("Contribute"));
    expect(contribute.getByRole("link", { name: "Card data" }).getAttribute("href")).toBe(
      "/contribute",
    );
    expect(contribute.getByRole("link", { name: "Support the site" }).getAttribute("href")).toBe(
      "/support",
    );
  });

  it("gates Card data behind sign-in for a signed-out visitor", () => {
    const onLockedClick = vi.fn();
    renderSheet({ isLoggedIn: false, onLockedClick });
    const contribute = within(section("Contribute"));
    expect(contribute.queryByRole("link", { name: "Card data" })).toBeNull();
    contribute.getByRole("button", { name: "Card data" }).click();
    expect(onLockedClick).toHaveBeenCalledWith("contribute");
    expect(contribute.getByRole("link", { name: "Support the site" })).toBeTruthy();
    expect(within(section("Help")).getAllByRole("link")).toHaveLength(5);
  });

  it("shows the unread dot on What's new only while a milestone is new", () => {
    const { unmount } = renderSheet({ isLoggedIn: true });
    expect(screen.queryByTestId("whats-new-unread-dot")).toBeNull();
    unmount();

    flags.hasNewMilestone = true;
    renderSheet({ isLoggedIn: true });
    const dot = screen.getByTestId("whats-new-unread-dot");
    expect(dot.closest("a")?.getAttribute("href")).toBe("/changelog");
  });
});
