import { enumLabel } from "@openrift/shared/enum-label";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { TEST_ZONE_LABELS } from "@/test/zone-order-stub";

import DeckBuildingArticle from "./deck-building";
import { ZoneOverview } from "./zone-overview";

vi.mock("@/hooks/use-enums", async () => {
  const { useZoneOrderStub } = await import("@/test/zone-order-stub");
  const { labelMapOf } = await import("@openrift/shared/enum-label");
  return {
    useZoneOrder: useZoneOrderStub,
    useDeckFormatList: () => ({ labels: labelMapOf({ constructed: "Constructed" }) }),
  };
});

vi.mock("@/components/ui/text-link", () => ({
  TextLink: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

describe("ZoneOverview", () => {
  it("shows the sideboard range from the deck rules", () => {
    render(<DeckBuildingArticle />);

    expect(screen.getByText("0–10")).toBeTruthy();
    expect(screen.queryByText("0–8")).toBeNull();
  });

  it("names zones with the admin labels in the admin order", () => {
    const { container } = render(
      <ZoneOverview descriptions={{ main: "main", champion: "champion", runes: "runes" }} />,
    );

    const names = [...container.querySelectorAll("[data-slot=card-title] > span:first-child")].map(
      (node) => node.textContent,
    );
    expect(names).toEqual([
      enumLabel(TEST_ZONE_LABELS, "champion"),
      enumLabel(TEST_ZONE_LABELS, "runes"),
      enumLabel(TEST_ZONE_LABELS, "main"),
    ]);
  });
});
