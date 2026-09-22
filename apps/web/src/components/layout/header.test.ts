import { describe, expect, it } from "vitest";

import { signInRedirectFor } from "./header";
import {
  navItemVisible,
  primaryNavItems,
  visibleMoreSections,
  visiblePrimaryItems,
} from "./nav-items";

const flagsOn = { glossary: true, meta: true, "board-states": true };
const flagsOff = { glossary: false, meta: false, "board-states": false };

describe("primaryNavItems", () => {
  const visible = (flags: typeof flagsOn, mobile: boolean) =>
    primaryNavItems()
      .filter((item) => navItemVisible(item, { flags, mobile }))
      .map((i) => i.to);

  it("hides the meta archive in both menus while its flag is off", () => {
    expect(visible(flagsOff, false)).not.toContain("/meta");
    expect(visible(flagsOff, true)).not.toContain("/meta");
  });

  it("shows the meta archive in both menus once its flag is on", () => {
    expect(visible(flagsOn, false)).toContain("/meta");
    expect(visible(flagsOn, true)).toContain("/meta");
  });

  it("keeps the unflagged entries whatever the flags say", () => {
    expect(visible(flagsOff, false)).toEqual(["/cards", "/collections", "/decks", "/groups"]);
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
