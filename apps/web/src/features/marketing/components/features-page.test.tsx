import type { LandingSummaryResponse } from "@openrift/shared/types/api/catalog";
import type * as ReactQuery from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const summary = vi.hoisted(() => ({ data: undefined as unknown }));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactQuery>()),
  useQuery: () => ({ data: summary.data }),
}));
function MockLink({ to, children }: { to?: string; children?: ReactNode }) {
  return <a href={to}>{children}</a>;
}

vi.mock("@tanstack/react-router", () => ({
  Link: MockLink,
  createLink: () => MockLink,
  useRouter: () => ({ preloadRoute: vi.fn() }),
}));
vi.mock("@/hooks/use-feature-flags", () => ({ useFeatureEnabled: () => true }));
vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ data: null, isPending: false }),
  useUserId: () => null,
}));

const { FeaturesPage } = await import("./features-page");

function staleSummary(): LandingSummaryResponse {
  const thumbnails = Array.from({ length: 36 }, (_, index) => ({
    imageId: `00000000-0000-0000-0000-${String(index).padStart(12, "0")}`,
    name: `Card ${index}`,
    shortCode: `OGN-${String(index).padStart(3, "0")}`,
    variantLabel: null,
    priceCents: 100,
  }));
  return {
    cardCount: 900,
    printingCount: 1200,
    copyCount: 0,
    thumbnailIds: thumbnails.map((thumb) => thumb.imageId),
    thumbnails,
    legendThumbnailIds: [],
    promoSections: [],
  } as unknown as LandingSummaryResponse;
}

describe("FeaturesPage", () => {
  it("renders from a cached sample that predates the rarity and domain fields", () => {
    summary.data = staleSummary();

    render(<FeaturesPage />);

    expect(screen.getByRole("heading", { name: "Features" })).toBeInTheDocument();
  });
});
