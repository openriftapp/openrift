import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

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

const { initQueryOptions } = await import("@/lib/init-queries");
const { stubInitResponse } = await import("@/test/init-fixtures");
const { ErrataNotice } = await import("./errata-notice");

function renderNotice(interactive?: boolean) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(initQueryOptions.queryKey, stubInitResponse());
  return render(
    <QueryClientProvider client={queryClient}>
      <ErrataNotice
        cardSlug="astral-heron"
        interactive={interactive}
        printedText="your next card costs less."
        source="Vendetta Errata Updates"
      />
    </QueryClientProvider>,
  );
}

describe("ErrataNotice", () => {
  it("leaves the link out of non-interactive surfaces", () => {
    renderNotice(false);

    expect(screen.queryByRole("link", { name: "All errata" })).not.toBeInTheDocument();
  });

  it("links to the card's entry on the errata page", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(initQueryOptions.queryKey, stubInitResponse());
    render(
      <QueryClientProvider client={queryClient}>
        <ErrataNotice
          cardSlug="astral-heron"
          printedText="your next card costs less."
          source="Vendetta Errata Updates"
        />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("link", { name: "All errata" })).toHaveAttribute(
      "href",
      "/errata#astral-heron",
    );
  });
});
