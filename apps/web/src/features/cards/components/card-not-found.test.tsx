import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type * as ReactRouter from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ cardSlug: "", navigate: vi.fn() }));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouter>()),
  Link: ({
    to,
    params,
    children,
    className,
  }: {
    to: string;
    params?: Record<string, string>;
    children: ReactNode;
    className?: string;
  }) => {
    let path = to.replaceAll(/\/\{-\$\w+\}/gu, "");
    for (const [key, value] of Object.entries(params ?? {})) {
      path = path.replace(`$${key}`, value);
    }
    return (
      <a href={path} className={className}>
        {children}
      </a>
    );
  },
  useParams: () => ({ cardSlug: router.cardSlug }),
  useNavigate: () => router.navigate,
}));

vi.mock("@/features/cards/lib/catalog-queries", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  catalogQueryOptions: {
    queryKey: ["test-catalog"],
    queryFn: () => new Promise<never>(() => {}),
    staleTime: Infinity,
  },
}));

vi.mock("@/features/cards/components/printing-option-content", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  PrintingThumbnail: () => <span data-testid="thumbnail" />,
}));

import { CardNotFound } from "@/features/cards/components/card-not-found";
import type { UseCardsResult } from "@/features/cards/lib/catalog-queries";
import { initKeys } from "@/lib/query-keys";
import { stubPrinting } from "@/test/factories";
import { stubInitResponse } from "@/test/init-fixtures";

const scorcher = stubPrinting({
  cardId: "card-scorcher",
  shortCode: "OGN-001",
  card: { slug: "blazing-scorcher", name: "Blazing Scorcher", types: ["unit"], domains: ["fury"] },
});

function catalogOf(printings: ReturnType<typeof stubPrinting>[]): UseCardsResult {
  return {
    allPrintings: printings,
    cardsById: Object.fromEntries(printings.map((printing) => [printing.cardId, printing.card])),
    printingsById: Object.fromEntries(printings.map((printing) => [printing.printingId, printing])),
    printingsBySideKey: {},
    sidesByPrinting: new Map(),
    printingsByCardId: Map.groupBy(printings, (printing) => printing.cardId),
    sets: [],
  };
}

function renderNotFound(cardSlug: string, catalog: UseCardsResult | null = catalogOf([scorcher])) {
  router.cardSlug = cardSlug;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (catalog) {
    client.setQueryData(["test-catalog"], catalog);
  }
  client.setQueryData(
    initKeys.all,
    stubInitResponse({
      cardTypes: [{ slug: "unit", label: "Unit", sortOrder: 0 }],
      domains: [{ slug: "fury", label: "Fury", sortOrder: 0, color: null }],
    }),
  );
  return render(
    <QueryClientProvider client={client}>
      <CardNotFound />
    </QueryClientProvider>,
  );
}

function searchField(): HTMLInputElement {
  return screen.getByRole("textbox", { name: "Search cards" });
}

beforeEach(() => {
  router.navigate.mockReset();
});

describe("CardNotFound", () => {
  it("says no card lives at the address", () => {
    renderNotFound("blazing-scorcherr");

    expect(
      screen.getByRole("heading", { level: 1, name: "No card at this address" }),
    ).toBeInTheDocument();
  });

  it("prefills the search with the slug as words", () => {
    renderNotFound("blazing-scorcherr");

    expect(searchField()).toHaveValue("blazing scorcherr");
  });

  it("opens the card browser with the typed search on submit", () => {
    renderNotFound("blazing-scorcherr");

    fireEvent.change(searchField(), { target: { value: "  jinx " } });
    fireEvent.submit(screen.getByRole("search"));

    expect(router.navigate).toHaveBeenCalledWith({ to: "/cards", search: { q: "jinx" } });
  });

  it("opens the unfiltered card browser when the search is cleared", () => {
    renderNotFound("blazing-scorcherr");

    fireEvent.change(searchField(), { target: { value: "" } });
    fireEvent.submit(screen.getByRole("search"));

    expect(router.navigate).toHaveBeenCalledWith({ to: "/cards", search: {} });
  });

  it("links the closest card with its code, type and domain", () => {
    renderNotFound("blazing-scorcherr");

    const link = screen.getByRole("link", { name: /Blazing Scorcher/u });
    expect(link).toHaveAttribute("href", "/cards/blazing-scorcher");
    expect(link).toHaveTextContent("OGN-001 · Unit · Fury");
  });

  it("suggests no card when none is close", () => {
    renderNotFound("summoner-skirmish");

    expect(screen.queryByRole("link", { name: /Blazing Scorcher/u })).not.toBeInTheDocument();
  });

  it("suggests no card before the catalog has loaded", () => {
    renderNotFound("blazing-scorcherr", null);

    expect(screen.queryByRole("link", { name: /Blazing Scorcher/u })).not.toBeInTheDocument();
  });

  it("links the full card browser", () => {
    renderNotFound("summoner-skirmish");

    expect(screen.getByRole("link", { name: "Browse all cards" })).toHaveAttribute(
      "href",
      "/cards",
    );
  });
});
