import type { MetaLegendSummary } from "@openrift/shared/types/api/meta";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({
  legends: [] as MetaLegendSummary[],
  total: 0,
  archiveTotal: 0,
  countries: [] as string[],
  scopes: [] as unknown[],
  search: {} as Record<string, unknown>,
  navigated: [] as Record<string, unknown>[],
}));

vi.mock("@tanstack/react-router", () => {
  function Anchor({
    to,
    params,
    children,
    className,
  }: {
    to?: string;
    params?: Record<string, string>;
    children?: React.ReactNode;
    className?: string;
  }) {
    const href = Object.entries(params ?? {}).reduce(
      (path, [key, value]) => path.replace(`$${key}`, value),
      to ?? "#",
    );
    return (
      <a href={href} className={className}>
        {children ?? "link"}
      </a>
    );
  }
  return {
    getRouteApi: () => ({
      useSearch: () => captured.search,
      useNavigate:
        () =>
        ({ search }: { search: (prev: Record<string, unknown>) => Record<string, unknown> }) => {
          captured.navigated.push(search(captured.search));
        },
    }),
    Link: Anchor,
    createLink: () => Anchor,
  };
});

vi.mock("@/features/meta/hooks/use-meta", () => ({
  useMetaLegends: (scope?: unknown) => {
    captured.scopes.push(scope);
    return {
      data: {
        legends: captured.legends,
        total: captured.total,
        archiveTotal: captured.archiveTotal,
        countries: captured.countries,
      },
    };
  },
}));
vi.mock("@/features/meta/hooks/use-meta-eras", () => ({ useMetaEras: () => [] }));
vi.mock("@/features/meta/components/meta-scope-bar", () => ({
  MetaScopeBar: ({ search }: { search?: React.ReactNode }) => <div>{search}</div>,
}));

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({
    orders: { domains: ["fury", "calm"] },
    labels: { domains: { fury: "Fury", calm: "Calm" } },
  }),
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { MetaLegendsPage } from "./meta-legends-page";

type LegendOverrides = Partial<Omit<MetaLegendSummary, "slug" | "legend">> & {
  event?: Partial<MetaLegendSummary["bestFinish"]["event"]>;
};

function legend(name: string, slug: string, overrides: LegendOverrides = {}): MetaLegendSummary {
  const { event, ...rest } = overrides;
  return {
    slug,
    legend: { cardId: slug, name, slug, imageId: null, domains: ["fury"], archiveSlug: slug },
    bestFinish: {
      rank: 8,
      rankIsTier: false,
      event: {
        slug: "summoner-skirmish",
        name: "Summoner Skirmish at Cardhouse Vienna",
        eventDate: "2026-08-29",
        format: "constructed",
        tier: "local",
        country: "AT",
        playerCount: 18,
        ...event,
      },
    },
    finishes: 1,
    decklists: 0,
    eventWins: 0,
    ...rest,
  };
}

function renderPage(
  legends: MetaLegendSummary[],
  search: Record<string, unknown> = {},
  total = legends.length,
  archiveTotal = total,
) {
  captured.legends = legends;
  captured.total = total;
  captured.archiveTotal = archiveTotal;
  captured.countries = ["AT"];
  captured.scopes = [];
  captured.search = search;
  captured.navigated = [];
  render(<MetaLegendsPage />);
}

function rankedBest(rank: number): MetaLegendSummary["bestFinish"] {
  const base = legend("x", "x").bestFinish;
  return { ...base, rank };
}

function rowLinks(): (string | null)[] {
  return screen
    .getAllByRole("link")
    .map((link) => link.getAttribute("href"))
    .filter((href) => href?.startsWith("/meta/legends/") === true);
}

describe("MetaLegendsPage", () => {
  beforeEach(() => {
    captured.navigated = [];
  });

  it("files legends under the name a reader sees by default", () => {
    renderPage([
      legend("Kennen, Heart of the Tempest", "kennen-heart-of-the-tempest"),
      legend("Azir, Emperor of the Sands", "azir-emperor-of-the-sands"),
    ]);
    expect(rowLinks()).toEqual([
      "/meta/legends/azir-emperor-of-the-sands",
      "/meta/legends/kennen-heart-of-the-tempest",
    ]);
  });

  it("shows each legend's best finish and its on-file counts", () => {
    renderPage([
      legend("Kennen, Heart of the Tempest", "kennen-heart-of-the-tempest", {
        bestFinish: {
          rank: 2,
          rankIsTier: false,
          event: {
            slug: "regional-lyon",
            name: "Regional Lyon",
            eventDate: "2026-08-29",
            format: "constructed",
            tier: "premier",
            country: "FR",
            playerCount: 512,
          },
        },
        finishes: 7,
        decklists: 3,
      }),
    ]);
    const row = screen.getByRole("link", { name: /kennen/iu });
    expect(within(row).getAllByText("Regional Lyon").length).toBeGreaterThan(0);
    expect(within(row).getAllByText("2nd")).not.toHaveLength(0);
    expect(within(row).getByText("2026-08-29 · 512 players")).toBeInTheDocument();
    expect(within(row).getByText("7")).toBeInTheDocument();
    expect(within(row).getByText("3")).toBeInTheDocument();
  });

  it("chips the events a legend has won", () => {
    renderPage([
      legend("Azir, Emperor of the Sands", "azir-emperor-of-the-sands", { eventWins: 1 }),
    ]);
    expect(screen.getAllByText("1 event win").length).toBeGreaterThan(0);
  });

  it("reorders by best finish from the column header", async () => {
    const user = userEvent.setup();
    renderPage([
      legend("Azir, Emperor of the Sands", "azir-emperor-of-the-sands", {
        bestFinish: rankedBest(5),
      }),
      legend("Kennen, Heart of the Tempest", "kennen-heart-of-the-tempest", {
        bestFinish: rankedBest(1),
        eventWins: 1,
      }),
    ]);
    await user.click(screen.getByRole("button", { name: "Sort by best finish in this scope" }));
    expect(captured.navigated).toEqual([expect.objectContaining({ by: "best", dir: "asc" })]);
  });

  it("renders the reader's chosen order from the URL", () => {
    renderPage(
      [
        legend("Azir, Emperor of the Sands", "azir-emperor-of-the-sands", {
          bestFinish: rankedBest(5),
        }),
        legend("Kennen, Heart of the Tempest", "kennen-heart-of-the-tempest", {
          bestFinish: rankedBest(1),
          eventWins: 1,
        }),
      ],
      { by: "best", dir: "asc" },
    );
    expect(rowLinks()).toEqual([
      "/meta/legends/kennen-heart-of-the-tempest",
      "/meta/legends/azir-emperor-of-the-sands",
    ]);
  });

  it("counts the legends the scope matched against the whole archive", () => {
    renderPage(
      [legend("Kennen, Heart of the Tempest", "kennen-heart-of-the-tempest")],
      { tiers: ["competitive"] },
      1,
      217,
    );

    expect(rowLinks()).toEqual(["/meta/legends/kennen-heart-of-the-tempest"]);
    expect(screen.getByText("1 of 217 legends")).toBeInTheDocument();
    expect(captured.scopes.at(-1)).toMatchObject({ tiers: ["competitive"] });
  });

  it("narrows to the legends whose name matches the query", () => {
    renderPage(
      [
        legend("Kennen, Heart of the Tempest", "kennen-heart-of-the-tempest"),
        legend("Azir, Emperor of the Sands", "azir-emperor-of-the-sands"),
      ],
      { q: "kennen" },
      2,
      217,
    );
    expect(screen.getAllByText("Kennen").length).toBeGreaterThan(0);
    expect(screen.queryByText("Azir")).not.toBeInTheDocument();
    expect(screen.getByText("1 of 217 legends")).toBeInTheDocument();
  });

  it("keeps the query reachable when the name query matched nothing", () => {
    renderPage(
      [legend("Kennen, Heart of the Tempest", "kennen-heart-of-the-tempest")],
      { q: "teemo" },
      1,
      217,
    );

    expect(screen.getByText("0 of 217 legends")).toBeInTheDocument();
    expect(screen.getByText("No legend matches these filters.")).toBeInTheDocument();
    expect(screen.queryByText("No legends on record yet")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search legends")).toBeInTheDocument();
  });

  it("explains an archive that holds no legend at all", () => {
    renderPage([], {}, 0, 0);

    expect(screen.getByText("No legends on record yet")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Search legends")).not.toBeInTheDocument();
  });

  it("keeps the filters reachable when the scope holds no legend", () => {
    renderPage([], { tiers: ["premier"] }, 0, 217);

    expect(screen.getByText("0 of 217 legends")).toBeInTheDocument();
    expect(screen.getByText("No legend matches these filters.")).toBeInTheDocument();
    expect(screen.queryByText("No legends on record yet")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search legends")).toBeInTheDocument();
  });

  it("asks for the era the scope names rather than the whole archive", () => {
    renderPage([legend("Kennen, Heart of the Tempest", "kennen-heart-of-the-tempest")], {
      era: "custom",
      from: "2026-08-01",
      to: "2026-09-30",
    });
    expect(captured.scopes.at(-1)).toMatchObject({ from: "2026-08-01", to: "2026-09-30" });
  });
});
