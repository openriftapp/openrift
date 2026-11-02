import type { CardErrata } from "@openrift/shared/types/catalog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  Link: ({
    to,
    hash,
    children,
    className,
  }: {
    to: string;
    hash?: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={hash ? `${to}#${hash}` : to} className={className}>
      {children}
    </a>
  ),
}));

const isMobile = vi.hoisted(() => ({ value: false }));

vi.mock("@/hooks/use-is-mobile", () => ({
  useIsMobile: () => isMobile.value,
}));

const { initQueryOptions } = await import("@/lib/init-queries");
const { stubInitResponse } = await import("@/test/init-fixtures");
const { ErrataCardText, ErrataScope } = await import("./errata-notice");
const { CardDetailDrawerShell } = await import("./card-detail-shells");

const errata: CardErrata = {
  correctedRulesText: "discard 1 as an additional cost.",
  correctedEffectText: null,
  source: "Official card gallery",
  sourceUrl: "https://example.com/gallery",
  effectiveDate: "2026-03-01",
};

function renderText(printed: string, corrected: string, scoped = true) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(initQueryOptions.queryKey, stubInitResponse());
  const text = <ErrataCardText printed={printed} corrected={corrected} />;
  return render(
    <QueryClientProvider client={queryClient}>
      {scoped ? (
        <ErrataScope
          cardSlug="scurvy-captain"
          errata={errata}
          changes={[{ key: "rules", printed, corrected }]}
        >
          <p>{text}</p>
        </ErrataScope>
      ) : (
        <p>{text}</p>
      )}
    </QueryClientProvider>,
  );
}

describe("ErrataCardText", () => {
  beforeEach(() => {
    isMobile.value = false;
  });

  it("opens the comparison from the changed word", async () => {
    const user = userEvent.setup();
    renderText("discard a card as an additional cost.", "discard 1 as an additional cost.");

    await user.click(screen.getByRole("button", { name: /Changed by errata/u }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Printed on the card")).toBeInTheDocument();
    expect(within(dialog).getByText("Updated wording")).toBeInTheDocument();
    expect(within(dialog).getByText("a card").tagName).toBe("DEL");
    expect(within(dialog).getByRole("link", { name: "All errata" })).toHaveAttribute(
      "href",
      "/errata#scurvy-captain",
    );
    expect(within(dialog).getByRole("link", { name: "Official card gallery" })).toHaveAttribute(
      "href",
      "https://example.com/gallery",
    );
  });

  it("marks the spot where words were removed", async () => {
    const user = userEvent.setup();
    renderText("Your other friendly units get +1.", "Your other units get +1.");

    await user.click(screen.getByRole("button", { name: /Text removed by errata/u }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("friendly").tagName).toBe("DEL");
  });

  it("opens a bottom sheet on phones", async () => {
    isMobile.value = true;
    const user = userEvent.setup();
    renderText("discard a card as an additional cost.", "discard 1 as an additional cost.");

    await user.click(screen.getByRole("button", { name: /Changed by errata/u }));

    await screen.findByRole("button", { name: "Close" });
    expect(document.querySelector("[data-slot=drawer-popup]")).not.toBeNull();
    expect(screen.getByText("Printed on the card")).toBeInTheDocument();
  });

  it("opens and closes the sheet inside the card detail drawer", async () => {
    isMobile.value = true;
    const user = userEvent.setup();
    const queryClient = new QueryClient();
    queryClient.setQueryData(initQueryOptions.queryKey, stubInitResponse());
    const printed = "discard a card as an additional cost.";
    const corrected = "discard 1 as an additional cost.";
    render(
      <QueryClientProvider client={queryClient}>
        <CardDetailDrawerShell onClose={vi.fn()}>
          <ErrataScope
            cardSlug="scurvy-captain"
            errata={errata}
            changes={[{ key: "rules", printed, corrected }]}
          >
            <p>
              <ErrataCardText printed={printed} corrected={corrected} />
            </p>
          </ErrataScope>
        </CardDetailDrawerShell>
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole("button", { name: /Changed by errata/u }));
    await user.click(await screen.findByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(screen.queryByText("Printed on the card")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Changed by errata/u })).toBeInTheDocument();
  });

  it("labels each block when rules and effect both changed", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient();
    queryClient.setQueryData(initQueryOptions.queryKey, stubInitResponse());
    render(
      <QueryClientProvider client={queryClient}>
        <ErrataScope
          cardSlug="scurvy-captain"
          errata={errata}
          changes={[
            { key: "rules", printed: "deal 2 to a unit.", corrected: "deal 3 to a unit." },
            { key: "effect", printed: "Your units get +1.", corrected: "Your other units get +1." },
          ]}
        >
          <p>
            <ErrataCardText printed="deal 2 to a unit." corrected="deal 3 to a unit." />
          </p>
        </ErrataScope>
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: /Changed by errata/u }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Rules text")).toBeInTheDocument();
    expect(within(dialog).getByText("Effect")).toBeInTheDocument();
  });

  it("renders plain text without a scope", () => {
    renderText("discard a card as an additional cost.", "discard 1 as an additional cost.", false);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("discard 1 as an additional cost.")).toBeInTheDocument();
  });
});
