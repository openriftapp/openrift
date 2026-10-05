import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LocaleBannerDecision } from "@/features/account/lib/locale-banner";
import type { LatestMilestone } from "@/features/marketing/lib/milestone-banner";

let localeDecision: LocaleBannerDecision = { kind: "hide" };
let milestone: LatestMilestone | null = null;
let installDue = false;

vi.mock("@/features/account/hooks/use-locale-banner", () => ({
  useLocaleBanner: () => localeDecision,
}));
vi.mock("@/features/marketing/hooks/use-milestone-banner", () => ({
  useMilestoneBanner: () => milestone,
}));
vi.mock("@/features/marketing/hooks/use-install-nudge", () => ({
  useInstallNudge: () => installDue,
}));
vi.mock("@/features/account/components/locale-banner", () => ({
  LocaleBanner: () => <div>locale banner</div>,
}));
vi.mock("@/features/marketing/components/milestone-banner", () => ({
  MilestoneBanner: () => <div>milestone banner</div>,
}));
vi.mock("@/features/marketing/components/install-nudge", () => ({
  InstallNudge: () => <div>install nudge</div>,
}));

const { SiteBanner } = await import("./site-banner");

const MILESTONE: LatestMilestone = { date: "2026-10-01", title: "Decks", message: "New." };

describe("SiteBanner", () => {
  beforeEach(() => {
    localeDecision = { kind: "hide" };
    milestone = null;
    installDue = false;
  });

  it("shows only the locale banner when all three are due", () => {
    localeDecision = { kind: "suggest", locale: "de" };
    milestone = MILESTONE;
    installDue = true;

    render(<SiteBanner />);

    expect(screen.getByText("locale banner")).toBeInTheDocument();
    expect(screen.queryByText("milestone banner")).not.toBeInTheDocument();
    expect(screen.queryByText("install nudge")).not.toBeInTheDocument();
  });

  it("shows the milestone banner ahead of the install nudge", () => {
    milestone = MILESTONE;
    installDue = true;

    render(<SiteBanner />);

    expect(screen.getByText("milestone banner")).toBeInTheDocument();
    expect(screen.queryByText("install nudge")).not.toBeInTheDocument();
  });

  it("renders nothing when no banner is due", () => {
    const { container } = render(<SiteBanner />);

    expect(container).toBeEmptyDOMElement();
  });
});
