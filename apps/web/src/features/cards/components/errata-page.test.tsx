import type { ErrataEntry, ErrataListResponse } from "@openrift/shared/contracts/errata";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const routeSearch: { q?: string } = {};
const navigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getRouteApi: () => ({ useSearch: () => routeSearch, useNavigate: () => navigate }),
  Link: ({
    to,
    params,
    children,
    className,
    ...rest
  }: {
    to: string;
    params?: Record<string, string>;
    children: ReactNode;
    className?: string;
  }) => {
    let path = to;
    for (const [key, value] of Object.entries(params ?? {})) {
      path = path.replace(`$${key}`, value);
    }
    return (
      <a href={path.replaceAll(/\/\{-\$[^}]+\}/gu, "")} className={className} {...rest}>
        {children}
      </a>
    );
  },
}));

const { errataListQueryOptions } = await import("@/features/cards/lib/errata-queries");
const { initQueryOptions } = await import("@/lib/init-queries");
const { stubInitResponse } = await import("@/test/init-fixtures");
const { ErrataPage } = await import("./errata-page");

function entry(
  name: string,
  overrides: Partial<ErrataEntry> & { setSlug?: string } = {},
): ErrataEntry {
  const { setSlug = "VEN", ...rest } = overrides;
  return {
    announcementId: "a-ven",
    source: null,
    sourceUrl: null,
    effectiveDate: null,
    correctedRulesText: "the next card you play costs less.",
    correctedEffectText: null,
    card: {
      slug: name.toLowerCase().replaceAll(" ", "-"),
      name,
      types: ["unit"],
      tags: [],
      domains: [],
    },
    printing: {
      shortCode: `${setSlug}-001`,
      setSlug,
      printedRulesText: "your next card costs less.",
      printedEffectText: null,
      imageId: null,
    },
    ...rest,
  };
}

const DATA: ErrataListResponse = {
  announcements: [
    {
      id: "a-ven",
      name: "Vendetta Errata Updates",
      publishedOn: "2026-07-23",
      url: "https://example.invalid/ven",
    },
    {
      id: "a-ogn",
      name: "Origins Card Errata",
      publishedOn: "2025-10-21",
      url: "https://example.invalid/ogn",
    },
  ],
  sets: [
    { slug: "OGN", name: "Origins" },
    { slug: "VEN", name: "Vendetta" },
  ],
  entries: [
    entry("Astral Heron"),
    entry("Arise", { announcementId: "a-ogn", setSlug: "OGN" }),
    entry("Gold", {
      announcementId: null,
      source: "Changed with the UNL-T05 token printing",
      setSlug: "OGN",
    }),
  ],
};

function renderPage() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(initQueryOptions.queryKey, stubInitResponse());
  queryClient.setQueryData(errataListQueryOptions.queryKey, DATA);
  return render(
    <QueryClientProvider client={queryClient}>
      <ErrataPage />
    </QueryClientProvider>,
  );
}

describe("ErrataPage", () => {
  it("opens the newest update and keeps collapsed updates in the markup", () => {
    const { container } = renderPage();

    expect(container.querySelector("#vendetta-errata-updates-list")).not.toHaveAttribute("hidden");
    const collapsed = container.querySelector("#origins-card-errata-list");
    expect(collapsed).toHaveAttribute("hidden");
    expect(collapsed).toHaveTextContent("Arise");
  });

  it("leads with the hero title and fans out the newest update's cards", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(initQueryOptions.queryKey, stubInitResponse());
    queryClient.setQueryData(errataListQueryOptions.queryKey, {
      ...DATA,
      entries: DATA.entries.map((item) =>
        item.printing
          ? { ...item, printing: { ...item.printing, imageId: `img-${item.card.slug}` } }
          : item,
      ),
    });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ErrataPage />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Riftbound card errata");
    const fan = [...container.querySelectorAll("[aria-hidden='true'] img")].map((img) =>
      img.getAttribute("src"),
    );
    expect(fan).toEqual(["/media/cards/on/img-astral-heron-400w.webp"]);
  });

  it("lists unannounced changes last with their source", () => {
    renderPage();

    const headings = screen.getAllByRole("heading", { level: 2 }).map((node) => node.textContent);
    expect(headings.slice(0, 3)).toEqual([
      "Vendetta Errata Updates",
      "Origins Card Errata",
      "Unannounced changes",
    ]);
    expect(screen.getByText("Changed with the UNL-T05 token printing")).toBeInTheDocument();
  });

  it("marks added and removed words", () => {
    const { container } = renderPage();
    const heron = container.querySelector("#astral-heron");

    const added = [...(heron?.querySelectorAll("ins") ?? [])].map((node) => node.textContent);
    const removed = [...(heron?.querySelectorAll("del") ?? [])].map((node) => node.textContent);
    expect(added).toEqual(["the", "you play"]);
    expect(removed).toEqual(["your"]);
  });

  it("filters by card name and opens every matching update", async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    await user.type(
      screen.getByRole("textbox", { name: "Search errata by card name or text" }),
      "arise",
    );

    expect(container.querySelector("#astral-heron")).toBeNull();
    const origins = container.querySelector("#origins-card-errata-list");
    expect(origins).not.toHaveAttribute("hidden");
    expect(within(origins as HTMLElement).getByText("Arise")).toBeInTheDocument();
  });

  it("writes the query to the address and reads it back", async () => {
    const user = userEvent.setup();
    navigate.mockClear();
    renderPage();

    await user.type(
      screen.getByRole("textbox", { name: "Search errata by card name or text" }),
      "arise",
    );

    await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
    const [options] = navigate.mock.calls.at(-1) ?? [];
    const { search } = options as {
      search: (prev: Record<string, unknown>) => Record<string, unknown>;
    };
    expect(search({})).toEqual({ q: "arise" });
  });

  it("starts filtered when the address carries a query", () => {
    routeSearch.q = "arise";
    const { container } = renderPage();
    routeSearch.q = undefined;

    expect(container.querySelector("#astral-heron")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Search errata by card name or text" })).toHaveValue(
      "arise",
    );
  });

  it("opens a collapsed update when the address links to one of its cards", () => {
    globalThis.location.hash = "#arise";
    const { container } = renderPage();

    expect(container.querySelector("#origins-card-errata-list")).not.toHaveAttribute("hidden");
    globalThis.location.hash = "";
  });

  it("shows an empty state when nothing matches", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByRole("textbox", { name: "Search errata by card name or text" }),
      "zzz",
    );

    expect(screen.getByText(/No errata match these filters\./u)).toBeInTheDocument();
  });
});
