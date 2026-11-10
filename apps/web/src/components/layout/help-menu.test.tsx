import { render, screen } from "@testing-library/react";
import { cloneElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SOCIAL_LINKS } from "@/lib/social-links";

const flags = vi.hoisted(() => ({ showInstall: true, hasNewMilestone: false }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className }: { to: string; children?: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

type Slot = ReactElement<{ className?: string; children?: ReactNode }>;

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ className, children }: { className?: string; children?: ReactNode }) => (
    <div data-testid="popover-trigger" className={className}>
      {children}
    </div>
  ),
  PopoverContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  PopoverClose: ({
    render: element,
    className,
    children,
  }: {
    render: Slot;
    className?: string;
    children?: ReactNode;
  }) => cloneElement(element, { className, children }),
}));

vi.mock("@/hooks/use-help-menu-flags", () => ({ useHelpMenuFlags: () => flags }));

import { ContributePopover, HelpPopover } from "./help-menu";

beforeEach(() => {
  flags.showInstall = true;
  flags.hasNewMilestone = false;
});

describe("HelpPopover", () => {
  it("renders from md up with the help links in popover order", () => {
    render(<HelpPopover />);
    expect(screen.getByTestId("popover-trigger").className).toContain("hidden");
    expect(screen.getByTestId("popover-trigger").className).toContain("md:inline-flex");
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/help",
      "/changelog",
      "/install",
      SOCIAL_LINKS.githubNewIssue,
      SOCIAL_LINKS.discordInvite,
    ]);
  });

  it("opens external links without a referrer", () => {
    render(<HelpPopover />);
    const discord = screen.getByRole("link", { name: /Ask on Discord/u });
    expect(discord.getAttribute("target")).toBe("_blank");
    expect(discord.getAttribute("rel")).toBe("noreferrer");
  });

  it("puts the unread dot on What's new while a milestone is new", () => {
    flags.hasNewMilestone = true;
    render(<HelpPopover />);
    const dot = screen.getByTestId("whats-new-unread-dot");
    expect(dot.closest("a")?.getAttribute("href")).toBe("/changelog");
  });
});

describe("ContributePopover", () => {
  it("renders from lg up and links Card data for a signed-in visitor", () => {
    render(<ContributePopover isLoggedIn onLockedClick={() => {}} />);
    expect(screen.getByTestId("popover-trigger").className).toContain("lg:inline-flex");
    expect(screen.getByRole("link", { name: /Card data/u }).getAttribute("href")).toBe(
      "/contribute",
    );
    expect(screen.getByRole("link", { name: /Support the site/u }).getAttribute("href")).toBe(
      "/support",
    );
  });

  it("gates Card data behind sign-in for a signed-out visitor", () => {
    const onLockedClick = vi.fn();
    render(<ContributePopover isLoggedIn={false} onLockedClick={onLockedClick} />);
    expect(screen.queryByRole("link", { name: /Card data/u })).toBeNull();
    screen.getByRole("button", { name: /Card data/u }).click();
    expect(onLockedClick).toHaveBeenCalledWith("contribute");
  });
});
