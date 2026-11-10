import { describe, expect, it } from "vitest";

import { authDestinationKey } from "@/features/account/lib/auth-destination";

import { navBadgeTotal, showsSignInButton, signInRedirectFor } from "./header";
import {
  contributeLinks,
  helpLinks,
  keepsSearch,
  moreNavSections,
  navItemVisible,
  primaryNavItems,
  splitTabletNav,
  visibleMoreSections,
  visiblePrimaryItems,
} from "./nav-items";

const flagsOn = { glossary: true, "board-states": true, scanner: true };
const flagsOff = { glossary: false, "board-states": false, scanner: false };

describe("primaryNavItems", () => {
  const visible = (flags: typeof flagsOn, mobile: boolean) =>
    primaryNavItems()
      .filter((item) => navItemVisible(item, { flags, mobile }))
      .map((i) => i.to);

  it("keeps the unflagged entries whatever the flags say", () => {
    expect(visible(flagsOff, false)).toEqual([
      "/cards",
      "/collections",
      "/decks",
      "/meta",
      "/groups",
    ]);
  });

  it("shows the mobile scan entry only while the scanner is available", () => {
    expect(visible(flagsOn, true)).toContain("/scan");
    expect(visible(flagsOff, true)).not.toContain("/scan");
  });
});

describe("visibleMoreSections", () => {
  it("puts the Stage and tier lists under Create on desktop", () => {
    const create = visibleMoreSections({ flags: flagsOn, mobile: false }).find(
      (s) => s.label === "Create",
    );
    expect(create?.items.map((i) => i.to)).toEqual(["/stage", "/tier-lists"]);
  });

  it("drops the Create section entirely in the mobile sheet", () => {
    const labels = visibleMoreSections({ flags: flagsOn, mobile: true }).map((s) => s.label);
    expect(labels).not.toContain("Create");
  });

  it("keeps the other sections in both menus", () => {
    const desktop = visibleMoreSections({ flags: flagsOn, mobile: false }).map((s) => s.label);
    const mobile = visibleMoreSections({ flags: flagsOn, mobile: true }).map((s) => s.label);
    expect(desktop).toEqual(["Play", "Organize", "Create", "Explore"]);
    expect(mobile).toEqual(["Play", "Organize", "Explore"]);
  });

  it("hides a flagged item while its flag is off", () => {
    const play = visibleMoreSections({ flags: flagsOff, mobile: false }).find(
      (s) => s.label === "Play",
    );
    expect(play?.items.map((i) => i.to)).not.toContain("/glossary");
  });

  it("drops the desktop scan entry while the scanner is unavailable", () => {
    const organize = (flags: typeof flagsOn) =>
      visibleMoreSections({ flags, mobile: false })
        .find((s) => s.label === "Organize")
        ?.items.map((i) => i.to);
    expect(organize(flagsOn)).toContain("/scan");
    expect(organize(flagsOff)).not.toContain("/scan");
  });

  it("lists Trades under Organize in both menus", () => {
    const organize = (mobile: boolean) =>
      visibleMoreSections({ flags: flagsOn, mobile })
        .find((s) => s.label === "Organize")
        ?.items.map((i) => i.to);
    expect(organize(false)).toContain("/trades");
    expect(organize(true)).toContain("/trades");
  });

  it("splits Scan by platform", () => {
    const organize = (mobile: boolean) =>
      visibleMoreSections({ flags: flagsOn, mobile })
        .find((s) => s.label === "Organize")
        ?.items.map((i) => i.to);
    expect(organize(false)).toContain("/scan");
    expect(organize(true)).not.toContain("/scan");
  });
});

describe("visiblePrimaryItems", () => {
  const noBadges = { groups: 0, trades: 0, loans: 0 };
  const organize = (mobile: boolean, badges: typeof noBadges) =>
    visibleMoreSections({ flags: flagsOn, mobile, badges })
      .find((s) => s.label === "Organize")
      ?.items.map((i) => i.to);

  it("keeps Trades in More while it has no badge", () => {
    for (const mobile of [false, true]) {
      const primary = visiblePrimaryItems({ flags: flagsOn, mobile, badges: noBadges });
      expect(primary.map((i) => i.to)).not.toContain("/trades");
      expect(organize(mobile, noBadges)).toContain("/trades");
    }
  });

  it("moves Trades into the main menu while it has a badge", () => {
    const badges = { ...noBadges, trades: 2 };
    for (const mobile of [false, true]) {
      const primary = visiblePrimaryItems({ flags: flagsOn, mobile, badges });
      expect(primary.at(-1)?.to).toBe("/trades");
      expect(organize(mobile, badges)).not.toContain("/trades");
    }
  });

  it("leaves Lending in More when only Lending has a badge", () => {
    const badges = { ...noBadges, loans: 3 };
    const primary = visiblePrimaryItems({ flags: flagsOn, mobile: false, badges });
    expect(primary.map((i) => i.to)).not.toContain("/loans");
    expect(organize(false, badges)).toContain("/loans");
  });
});

describe("splitTabletNav", () => {
  const noBadges = { groups: 0, trades: 0, loans: 0 };
  const split = (badges: typeof noBadges) => {
    const { bar, overflow } = splitTabletNav(
      visiblePrimaryItems({ flags: flagsOn, mobile: false, badges }),
    );
    return { bar: bar.map((i) => i.to), overflow: overflow.map((i) => i.to) };
  };

  it("keeps the first four links in the tablet bar and moves Groups under More", () => {
    expect(split(noBadges)).toEqual({
      bar: ["/cards", "/collections", "/decks", "/meta"],
      overflow: ["/groups"],
    });
  });

  it("moves a promoted Trades link under More too", () => {
    expect(split({ ...noBadges, trades: 1 }).overflow).toEqual(["/groups", "/trades"]);
  });

  it("returns no overflow when every link fits", () => {
    const items = primaryNavItems().slice(0, 2);
    expect(splitTabletNav(items).overflow).toEqual([]);
    expect(splitTabletNav(items).bar).toEqual(items);
  });
});

describe("showsSignInButton", () => {
  it("hides the button on the sign-in, sign-up, reset and verify pages", () => {
    for (const pathname of ["/login", "/signup", "/reset-password", "/verify-email"]) {
      expect(showsSignInButton(pathname)).toBe(false);
    }
  });

  it("shows the button everywhere else, the landing page included", () => {
    for (const pathname of ["/", "/cards", "/login-help"]) {
      expect(showsSignInButton(pathname)).toBe(true);
    }
  });
});

describe("signInRedirectFor", () => {
  it("returns to the page the user was on, search included", () => {
    expect(signInRedirectFor({ pathname: "/cards", href: "/cards?q=vi" })).toBe("/cards?q=vi");
  });

  it("carries no redirect from the marketing page", () => {
    expect(signInRedirectFor({ pathname: "/", href: "/" })).toBeUndefined();
  });

  it("carries no redirect from an auth page", () => {
    expect(signInRedirectFor({ pathname: "/login", href: "/login" })).toBeUndefined();
    expect(signInRedirectFor({ pathname: "/signup", href: "/signup?email=a" })).toBeUndefined();
    expect(signInRedirectFor({ pathname: "/verify-email", href: "/verify-email" })).toBeUndefined();
    expect(
      signInRedirectFor({ pathname: "/reset-password", href: "/reset-password" }),
    ).toBeUndefined();
  });

  it("keeps a nested path under an excluded prefix", () => {
    expect(signInRedirectFor({ pathname: "/decks/abc", href: "/decks/abc" })).toBe("/decks/abc");
  });
});

describe("keepsSearch", () => {
  const cards = primaryNavItems().find((item) => item.to === "/cards");
  const meta = primaryNavItems().find((item) => item.to === "/meta");

  it("keeps the card filters when Cards is clicked on /cards", () => {
    expect(cards && keepsSearch(cards, "/cards")).toBe(true);
  });

  it("drops the login page's redirect param when Cards is clicked on /login", () => {
    expect(cards && keepsSearch(cards, "/login")).toBe(false);
  });

  it("never keeps the search for items without keepSearch", () => {
    expect(meta && keepsSearch(meta, "/meta")).toBe(false);
  });
});

describe("sign-in wall destinations", () => {
  it("names the destination of every nav entry that asks a signed-out visitor to sign in", () => {
    const locked = [
      ...primaryNavItems(),
      ...moreNavSections().flatMap((section) => section.items),
    ].filter((item) => item.lockedKey !== undefined);

    expect(locked.length).toBeGreaterThan(0);
    for (const item of locked) {
      expect(authDestinationKey(item.to)).toBe(item.lockedKey);
    }
  });

  it("links Scan for signed-out visitors without a sign-in wall", () => {
    const scan = [
      ...primaryNavItems(),
      ...moreNavSections().flatMap((section) => section.items),
    ].filter((item) => item.to === "/scan");

    expect(scan.length).toBeGreaterThan(0);
    for (const item of scan) {
      expect(item.lockedKey).toBeUndefined();
      expect(item.flag).toBe("scanner");
    }
  });
});

describe("navBadgeTotal", () => {
  it("adds group requests, trades and loans for the phone menu badge", () => {
    expect(navBadgeTotal({ groups: 1, trades: 2, loans: 3 })).toBe(6);
  });

  it("is zero when nothing needs attention", () => {
    expect(navBadgeTotal({ groups: 0, trades: 0, loans: 0 })).toBe(0);
  });
});

describe("helpLinks", () => {
  const ids = (opts: Parameters<typeof helpLinks>[0]) => helpLinks(opts).map((link) => link.id);

  it("lists the popover order with Get the app third", () => {
    expect(ids({ showInstall: true })).toEqual([
      "help",
      "whats-new",
      "install",
      "report-bug",
      "discord",
    ]);
  });

  it("moves Get the app to the end for the phone sheet", () => {
    expect(ids({ showInstall: true, installLast: true })).toEqual([
      "help",
      "whats-new",
      "report-bug",
      "discord",
      "install",
    ]);
  });

  it("drops Get the app when the site already runs as an installed app", () => {
    expect(ids({ showInstall: false })).not.toContain("install");
    expect(ids({ showInstall: false, installLast: true })).not.toContain("install");
  });

  it("marks only What's new for the unread dot", () => {
    const dotted = helpLinks({ showInstall: true }).filter((link) => link.unreadDot);
    expect(dotted.map((link) => link.id)).toEqual(["whats-new"]);
  });

  it("points internal links at routes and external links at full URLs", () => {
    const byId = new Map(helpLinks({ showInstall: true }).map((link) => [link.id, link]));
    expect(byId.get("help")?.to).toBe("/help");
    expect(byId.get("whats-new")?.to).toBe("/changelog");
    expect(byId.get("install")?.to).toBe("/install");
    expect(byId.get("report-bug")?.href).toMatch(/^https:\/\/github\.com\//u);
    expect(byId.get("discord")?.href).toMatch(/^https:\/\/discord\.gg\//u);
  });
});

describe("contributeLinks", () => {
  it("lists Card data behind the contribute sign-in gate, then Support the site", () => {
    expect(contributeLinks().map(({ id, to, lockedKey }) => ({ id, to, lockedKey }))).toEqual([
      { id: "card-data", to: "/contribute", lockedKey: "contribute" },
      { id: "support", to: "/support", lockedKey: undefined },
    ]);
  });
});
