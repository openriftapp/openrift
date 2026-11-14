import { labelMapOf } from "@openrift/shared/enum-label";
import { MARKETPLACE_LINKS } from "@openrift/shared/marketplace";
import { ALL_MARKETPLACES } from "@openrift/shared/types/pricing";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SOCIAL_LINKS } from "@/lib/social-links";

import { SupportPage } from "./support-page";

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({ labels: { rarities: labelMapOf({ common: "Common" }) } }),
}));

vi.mock("@/features/cards/components/card-text", () => ({
  CardText: ({ text }: { text: string }) => <span>{text}</span>,
}));

describe("SupportPage", () => {
  it("links every marketplace that pays a commission, and only those", () => {
    render(<SupportPage />);

    for (const marketplace of ALL_MARKETPLACES) {
      const { label, isAffiliate } = MARKETPLACE_LINKS[marketplace];
      const link = screen.queryByRole("link", { name: label });
      if (isAffiliate) {
        expect(link, label).not.toBeNull();
      } else {
        expect(link, label).toBeNull();
        expect(screen.getAllByText(label, { exact: false }).length).toBeGreaterThan(0);
      }
    }
  });

  it("sends sponsors to the shared sponsor links", () => {
    const { container } = render(<SupportPage />);
    const hrefs = [...container.querySelectorAll("a")].map((link) => link.getAttribute("href"));

    expect(hrefs).toContain(SOCIAL_LINKS.kofi);
    expect(hrefs).toContain(SOCIAL_LINKS.githubSponsors);
  });
});
