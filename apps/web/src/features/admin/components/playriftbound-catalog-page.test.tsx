import type {
  PlayriftboundCatalogListResponse,
  PlayriftboundCatalogRow,
} from "@openrift/shared/contracts/admin/meta-catalog";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlayriftboundCatalogParams } from "@/features/admin/hooks/use-admin-playriftbound-catalog";

const captured = vi.hoisted(() => ({
  params: null as unknown,
  response: null as unknown,
  accept: vi.fn(),
  dismiss: vi.fn(),
  undismiss: vi.fn(),
  fetch: vi.fn(),
}));

/** Stands in for the router: navigate() writes here, useSearch() reads it back. */
const searchStore = vi.hoisted(() => {
  let value: Record<string, unknown> = {};
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next: Record<string, unknown>) => {
      value = next;
      for (const listener of listeners) {
        listener();
      }
    },
    seed: (next: Record<string, unknown>) => {
      value = next;
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

vi.mock("@tanstack/react-router", async () => {
  const { useSyncExternalStore } = await import("react");
  const navigate =
    () => (options: { search?: (prev: Record<string, unknown>) => Record<string, unknown> }) => {
      if (options.search) {
        searchStore.set(options.search(searchStore.get()));
      }
    };
  return {
    Link: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    useNavigate: navigate,
    getRouteApi: () => ({
      useNavigate: navigate,
      useSearch: () =>
        useSyncExternalStore(searchStore.subscribe, searchStore.get, searchStore.get),
    }),
    // `page-top-bar` builds its back button with createLink at module scope.
    createLink: (component: unknown) => component,
  };
});

vi.mock("@/features/admin/components/admin-page-top-bar", () => ({
  AdminPageTopBar: ({ actions }: { actions?: ReactNode }) => <div>{actions}</div>,
}));

vi.mock("@/features/admin/hooks/use-admin-playriftbound-catalog", () => ({
  PLAYRIFTBOUND_CATALOG_PAGE_SIZE: 50,
  useAdminPlayriftboundCatalog: (params: PlayriftboundCatalogParams) => {
    captured.params = params;
    return { data: captured.response };
  },
  useAcceptPlayriftboundEvent: () => ({ mutate: captured.accept, isPending: false }),
  useDismissPlayriftboundEvent: () => ({
    mutate: captured.dismiss,
    mutateAsync: (input: unknown) => Promise.resolve(captured.dismiss(input)),
    isPending: false,
  }),
  useUndismissPlayriftboundEvent: () => ({ mutate: captured.undismiss, isPending: false }),
  useFetchPlayriftboundEvent: () => ({
    mutateAsync: (input: unknown) => {
      captured.fetch(input);
      return Promise.resolve({ status: "running", runId: "run-1", message: null, result: null });
    },
    isPending: false,
  }),
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { PlayriftboundCatalogPage } from "./playriftbound-catalog-page";

function makeRow(overrides: Partial<PlayriftboundCatalogRow> = {}): PlayriftboundCatalogRow {
  return {
    tournamentId: "117000000000000001",
    name: "Bandle City Summoner Skirmish",
    organizerName: "Bandle City Games",
    city: "Bandle City",
    tournamentType: "SUMMONER_SKIRMISH",
    format: "CONSTRUCTED",
    playerFormat: "ONE_V_ONE",
    registeredCount: 14,
    participantCapacity: 32,
    startAt: "2026-10-17T16:00:00.000Z",
    triage: "new",
    metaEventId: null,
    metaEventSlug: null,
    fetchedAt: null,
    missingSince: null,
    nextCheckAt: null,
    roundCount: null,
    roundsPlayed: null,
    roundsFinalized: null,
    stagedPlayerCount: 0,
    stagedMatchCount: 0,
    sourceUrl: "https://playriftbound.com/en-US/events/117000000000000001",
    ...overrides,
  };
}

function setResponse(
  rows: PlayriftboundCatalogRow[],
  overrides: Partial<PlayriftboundCatalogListResponse> = {},
) {
  captured.response = {
    rows,
    total: rows.length,
    page: 1,
    limit: 50,
    counts: { new: 7, accepted: 2, dismissed: 1 },
    ...overrides,
  } satisfies PlayriftboundCatalogListResponse;
}

function rowActions(name: string) {
  return within(screen.getByRole("row", { name: new RegExp(name, "u") }));
}

describe("PlayriftboundCatalogPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.params = null;
    searchStore.seed({});
    setResponse([makeRow()]);
  });

  it("asks for the untriaged rows first, since that is the queue being worked", () => {
    render(<PlayriftboundCatalogPage />);
    expect(captured.params).toMatchObject({ page: 1, triage: "new" });
  });

  it("shows the event's type, format, field and store", () => {
    render(<PlayriftboundCatalogPage />);
    expect(screen.getByText("Summoner Skirmish")).toBeInTheDocument();
    expect(screen.getByText("Constructed")).toBeInTheDocument();
    expect(screen.getByText("14 / 32")).toBeInTheDocument();
    expect(screen.getByText("Bandle City Games, Bandle City")).toBeInTheDocument();
  });

  it("links the event's name at the source's own page", () => {
    render(<PlayriftboundCatalogPage />);
    expect(screen.getByRole("link", { name: "Bandle City Summoner Skirmish" })).toHaveAttribute(
      "href",
      "https://playriftbound.com/en-US/events/117000000000000001",
    );
  });

  it("marks a team event and a row the source stopped listing", () => {
    setResponse([makeRow({ playerFormat: "TWO_V_TWO", missingSince: "2026-10-18T00:00:00.000Z" })]);
    render(<PlayriftboundCatalogPage />);
    expect(screen.getByText("Team")).toBeInTheDocument();
    expect(screen.getByText("Missing")).toBeInTheDocument();
  });

  it("shows what an accepted row holds and how far its rounds got", () => {
    setResponse([
      makeRow({
        triage: "accepted",
        metaEventId: "live-1",
        fetchedAt: "2026-10-17T22:00:00.000Z",
        stagedPlayerCount: 14,
        stagedMatchCount: 28,
        roundCount: 4,
        roundsPlayed: 4,
        roundsFinalized: 4,
      }),
    ]);
    render(<PlayriftboundCatalogPage />);
    expect(screen.getByText("14 standings")).toBeInTheDocument();
    expect(screen.getByText("28 pairings")).toBeInTheDocument();
    expect(screen.getByText("4 of 4 rounds")).toBeInTheDocument();
  });

  it("accepts a row by its tournament id", async () => {
    render(<PlayriftboundCatalogPage />);
    await userEvent.click(
      rowActions("Bandle City Summoner").getByRole("button", { name: "Accept" }),
    );
    expect(captured.accept).toHaveBeenCalledWith({ tournamentId: "117000000000000001" });
  });

  it("fetches an accepted row's results on demand", async () => {
    setResponse([makeRow({ triage: "accepted", metaEventId: "live-1" })]);
    render(<PlayriftboundCatalogPage />);
    await userEvent.click(
      rowActions("Bandle City Summoner").getByRole("button", { name: /Fetch now/u }),
    );
    expect(captured.fetch).toHaveBeenCalledWith({ tournamentId: "117000000000000001" });
  });

  it("offers an undismiss, and nothing else, for a dismissed row", () => {
    setResponse([makeRow({ triage: "dismissed" })]);
    render(<PlayriftboundCatalogPage />);
    const actions = rowActions("Bandle City Summoner");
    expect(actions.getByRole("button", { name: "Undismiss" })).toBeInTheDocument();
    expect(actions.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
  });

  it("carries the type and format filters into the query", () => {
    searchStore.seed({ prType: "PRE_RIFT", prFormat: "LIMITED_SEALED" });
    render(<PlayriftboundCatalogPage />);
    expect(captured.params).toMatchObject({ tournamentType: "PRE_RIFT", format: "LIMITED_SEALED" });
  });

  it("drops the type filter when the reader clears it", async () => {
    searchStore.seed({ prType: "PRE_RIFT" });
    render(<PlayriftboundCatalogPage />);
    await userEvent.click(screen.getByRole("combobox", { name: "Event type" }));
    await userEvent.click(await screen.findByRole("option", { name: "Any type" }));
    expect(captured.params).toMatchObject({ tournamentType: undefined });
  });
});
