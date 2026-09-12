import type { MissingImagePrinting } from "@openrift/shared/contracts/card-submissions";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

const missingImages = vi.hoisted(() => ({ items: [] as MissingImagePrinting[] }));

vi.mock("@/features/contribute/hooks/use-missing-images", () => ({
  useMyMissingImages: () => ({ data: { items: missingImages.items } }),
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { useOnboardingStore } from "@/features/account/stores/onboarding-store";
// oxlint-disable-next-line import/first -- must import after vi.mock
import { CollectionMissingImagesCallout } from "@/features/collections/components/collection-missing-images-callout";
// oxlint-disable-next-line import/first -- must import after vi.mock
import { initKeys } from "@/lib/query-keys";
// oxlint-disable-next-line import/first -- must import after vi.mock
import { stubMissingImagePrinting } from "@/test/factories";
// oxlint-disable-next-line import/first -- must import after vi.mock
import { stubInitResponse } from "@/test/init-fixtures";
// oxlint-disable-next-line import/first -- must import after vi.mock
import { createStoreResetter } from "@/test/store-helpers";

const resetOnboarding = createStoreResetter(useOnboardingStore);

function renderCallout(items: MissingImagePrinting[]) {
  missingImages.items = items;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(initKeys.all, stubInitResponse());
  return render(
    <QueryClientProvider client={client}>
      <CollectionMissingImagesCallout />
    </QueryClientProvider>,
  );
}

describe("CollectionMissingImagesCallout", () => {
  beforeEach(resetOnboarding);
  afterEach(resetOnboarding);

  it("renders nothing when nothing is missing an image", () => {
    const { container } = renderCallout([]);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing once every missing printing is dismissed", () => {
    useOnboardingStore.getState().dismissMissingImagesNudge(["printing-1"]);
    const { container } = renderCallout([stubMissingImagePrinting(1)]);

    expect(container).toBeEmptyDOMElement();
  });

  it("comes back when a printing outside the dismissed set is missing an image", () => {
    useOnboardingStore.getState().dismissMissingImagesNudge(["printing-1"]);
    renderCallout([stubMissingImagePrinting(1), stubMissingImagePrinting(2)]);

    expect(screen.getByText("We don't have photos for 2 of your owned cards.")).toBeInTheDocument();
  });

  it("stays hidden when a dismissed printing gains an image", () => {
    useOnboardingStore.getState().dismissMissingImagesNudge(["printing-1", "printing-2"]);
    const { container } = renderCallout([stubMissingImagePrinting(2)]);

    expect(container).toBeEmptyDOMElement();
  });

  it("records the printings on screen when dismissed", async () => {
    const user = userEvent.setup();
    renderCallout([stubMissingImagePrinting(1), stubMissingImagePrinting(2)]);

    await user.click(screen.getByRole("button", { name: "Dismiss the missing photos nudge" }));

    expect(useOnboardingStore.getState().dismissedMissingImagePrintings).toEqual([
      "printing-1",
      "printing-2",
    ]);
  });

  it("points its action at the contribute page", () => {
    renderCallout([stubMissingImagePrinting(1), stubMissingImagePrinting(2)]);

    expect(screen.getByText("We don't have photos for 2 of your owned cards.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add photos" })).toHaveAttribute("href", "/contribute");
  });

  it("uses singular copy for a single card", () => {
    renderCallout([stubMissingImagePrinting(1)]);

    expect(
      screen.getByText("We don't have a photo for one of your owned cards."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add a photo" })).toBeInTheDocument();
  });

  it("lists the first three cards as links and counts the rest", () => {
    renderCallout([1, 2, 3, 4, 5].map((index) => stubMissingImagePrinting(index)));

    expect(screen.getByRole("link", { name: "Card 1" })).toHaveAttribute(
      "href",
      "/contribute/card/$cardSlug/printing/$printingId/image",
    );
    expect(screen.getByRole("link", { name: "Card 3" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Card 4" })).not.toBeInTheDocument();
    expect(screen.getByText(/and 2 more/u)).toBeInTheDocument();
  });
});
