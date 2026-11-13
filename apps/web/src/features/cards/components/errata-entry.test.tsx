import type { ErrataEntry as ErrataEntryData } from "@openrift/shared/contracts/errata";
import { DEFAULT_DOMAIN_COLORS } from "@openrift/shared/domain-colors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a href="/cards" className={className}>
      {children}
    </a>
  ),
}));

const { initQueryOptions } = await import("@/lib/init-queries");
const { stubInitResponse } = await import("@/test/init-fixtures");
const { ErrataEntry } = await import("./errata-entry");

const ENTRY: ErrataEntryData = {
  language: "EN",
  announcementId: "a-ven",
  source: null,
  sourceUrl: null,
  effectiveDate: null,
  correctedRulesText: "the next card you play costs less.",
  correctedEffectText: null,
  card: {
    slug: "astral-heron",
    name: "Astral Heron",
    types: ["unit"],
    tags: [],
    domains: ["fury"],
  },
  printing: null,
};

describe("ErrataEntry", () => {
  it("paints the domain dot with the default colour when the domain has none of its own", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      initQueryOptions.queryKey,
      stubInitResponse({ domains: [{ slug: "fury", label: "Fury", sortOrder: 0, color: null }] }),
    );

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ErrataEntry entry={ENTRY} view="inline" />
      </QueryClientProvider>,
    );

    const dot = container.querySelector<HTMLElement>("span.rounded-full");
    expect(dot?.style.backgroundColor).toBe(DEFAULT_DOMAIN_COLORS.fury);
  });
});
