import type { MetaSource, MetaSyncStatus } from "@openrift/shared/contracts/admin/meta-catalog";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({
  statuses: {} as Partial<Record<string, unknown>>,
  search: {} as Record<string, unknown>,
  overlays: [] as unknown[],
  corrections: { items: [] as unknown[], hasMore: false },
  schedules: [] as unknown[],
  run: vi.fn(),
  cancel: vi.fn(),
  reject: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, search }: { children?: ReactNode; search?: unknown }) => (
    <a
      href="/admin/meta"
      data-search={JSON.stringify(
        typeof search === "function"
          ? (search as (prev: Record<string, unknown>) => unknown)({})
          : search,
      )}
    >
      {children}
    </a>
  ),
  getRouteApi: () => ({
    useSearch: ({ select }: { select: (search: Record<string, unknown>) => unknown }) =>
      select(captured.search),
  }),
  createLink: (component: unknown) => component,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children?: ReactNode }) => (
    <div role="menu">{children}</div>
  ),
  DropdownMenuItem: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
    <button type="button" role="menuitem" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => null,
}));

vi.mock("@/features/admin/components/admin-page-top-bar", () => ({
  AdminPageTopBar: ({ actions }: { actions?: ReactNode }) => <div>{actions}</div>,
}));

vi.mock("@/features/admin/hooks/use-admin-meta-catalog", () => ({
  SYNC_STATUS_POLL_MS: 15_000,
  useMetaSyncStatus: (source: string) => ({
    data: captured.statuses[source],
    refetch: vi.fn(),
    isFetching: false,
    dataUpdatedAt: 0,
  }),
  useMetaSyncSettings: () => ({
    data: {
      autoAcceptMinPlayers: 16,
      autoAcceptNotable: false,
      autoAcceptOfficial: false,
      competitivePlayerFloor: 32,
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
  }),
  useRunMetaSync: () => ({ mutateAsync: captured.run, isPending: false, variables: undefined }),
  useCancelMetaRun: () => ({ mutate: captured.cancel, isPending: false }),
  useMetaArchiveJobs: () => ({ data: { runs: [] } }),
  useRejectPassingNoResults: () => ({ mutate: captured.reject, isPending: false }),
}));

vi.mock("@/features/admin/hooks/use-admin-meta-overlays", () => ({
  useAdminMetaOverlays: () => ({ data: { overlays: captured.overlays } }),
}));

vi.mock("@/features/admin/hooks/use-admin-meta-submissions", () => ({
  useMetaEventCorrections: () => ({ data: captured.corrections }),
}));

vi.mock("@/features/admin/hooks/use-job-schedules", () => ({
  useJobSchedulesQuery: () => ({ data: { jobs: captured.schedules } }),
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { MetaAdminOverviewPage } from "./meta-admin-overview-page";

const NOW = new Date("2026-10-28T15:00:00.000Z");

type Run = MetaSyncStatus["runs"][number];

function run(kind: string, overrides: Partial<Run> = {}): Run {
  return {
    id: `run-${kind}`,
    kind,
    trigger: "cron",
    status: "succeeded",
    startedAt: "2026-10-28T14:50:00.000Z",
    finishedAt: "2026-10-28T14:51:00.000Z",
    durationMs: 60_000,
    errorMessage: null,
    result: null,
    ...overrides,
  };
}

function status(
  source: MetaSource,
  catalog: Partial<MetaSyncStatus["catalog"]> = {},
  runs: Run[] = [],
): MetaSyncStatus {
  return {
    catalog: {
      total: 39_089,
      completed: 6006,
      decklistPublished: 0,
      missing: 0,
      queued: 669,
      dueRecheck: 0,
      oldestDueAt: null,
      acceptedAwaitingResults: 303,
      acceptedMissing: 0,
      acceptedCancelled: 0,
      lastSeenAt: "2026-10-28T12:00:00.000Z",
      notStarted: 303,
      firstStartAt: "2026-10-28T15:30:00.000Z",
      collecting: 366,
      nextCheckAt: "2026-10-28T15:30:00.000Z",
      final: 6181,
      noResults: 92,
      needsDecision: 0,
      passingNoResults: 60,
      skippedUpcoming: 8209,
      skippedPast: 23_878,
      ...catalog,
    },
    archive: {
      events: 6942,
      eventsWithStandings: 6181,
      eventsWithDecklists: 0,
      decks: 0,
      addedLast7Days: 432,
    },
    counts: { new: 32_147, accepted: 6942, dismissed: 0 },
    runs: runs.length > 0 ? runs : [run(`meta.${source}_sync`, { result: { inserted: 270 } })],
    schedules: { [`meta.${source}_sync`]: true, [`meta.${source}_recheck`]: true },
  };
}

function row(name: string) {
  const link = screen.getByRole("link", { name });
  const element = link.closest("tr");
  if (element === null) {
    throw new Error(`No row for ${name}`);
  }
  return within(element);
}

describe("MetaAdminOverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
    captured.search = {};
    captured.overlays = [];
    captured.corrections = { items: [], hasMore: false };
    captured.schedules = [];
    captured.statuses = {
      uvsgames: status("uvsgames"),
      playloltcg: status("playloltcg"),
      topdeck: status("topdeck"),
      playriftbound: status("playriftbound"),
    };
    captured.run.mockResolvedValue({ status: "running", runId: "r", message: null, result: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows one row per source with what the last mirror refresh did", () => {
    render(<MetaAdminOverviewPage />);

    const playriftbound = row("PlayRiftbound");
    expect(playriftbound.getByText("6,942")).toBeInTheDocument();
    expect(playriftbound.getByText("+432 in 7 days")).toBeInTheDocument();
    expect(playriftbound.getByText("270 new")).toBeInTheDocument();
    expect(playriftbound.getByText("2026-10-28 14:50 · 270 new")).toBeInTheDocument();
    expect(playriftbound.getByText("first 2026-10-28 15:30")).toBeInTheDocument();
    expect(playriftbound.getByText("366")).toBeInTheDocument();
  });

  it("shows the next check while nothing is overdue", () => {
    render(<MetaAdminOverviewPage />);

    expect(row("PlayRiftbound").getByText("next 2026-10-28 15:30")).toBeInTheDocument();
  });

  it("shows the overdue count and its age once the queue falls behind", () => {
    captured.statuses.playloltcg = status("playloltcg", {
      dueRecheck: 123,
      oldestDueAt: "2026-10-27T21:00:00.000Z",
    });

    render(<MetaAdminOverviewPage />);

    const playloltcg = row("Play LoL TCG");
    expect(playloltcg.getByText("123")).toHaveClass("text-warning");
    expect(playloltcg.getByText("oldest 18h ago")).toBeInTheDocument();
  });

  it("marks result columns n/a for a source whose refresh carries the results", () => {
    render(<MetaAdminOverviewPage />);

    expect(row("TopDeck.gg").getAllByText("n/a")).toHaveLength(2);
    expect(row("PlayRiftbound").queryByText("n/a")).not.toBeInTheDocument();
  });

  it("shows a refresh that read nothing by its first error", () => {
    captured.statuses.playriftbound = status("playriftbound", {}, [
      run("meta.playriftbound_sync", {
        result: { rows: 0, inserted: 0, errors: ["No stores are known yet."] },
      }),
    ]);

    render(<MetaAdminOverviewPage />);

    expect(row("PlayRiftbound").getAllByText("No stores are known yet.").length).toBeGreaterThan(0);
  });

  it("counts review items from overlays and corrections, and flags a truncated list", () => {
    captured.overlays = [{ id: "o-1" }, { id: "o-2" }];
    captured.corrections = { items: [{ id: "c-1" }], hasMore: true };

    render(<MetaAdminOverviewPage />);

    expect(screen.getByRole("link", { name: /^Review/u })).toHaveTextContent("3+");
  });

  it("sums the events that need a decision and links to the first source holding some", () => {
    captured.statuses.uvsgames = status("uvsgames", { needsDecision: 2 });
    captured.statuses.topdeck = status("topdeck", { needsDecision: 1 });

    render(<MetaAdminOverviewPage />);

    const card = screen.getByRole("link", { name: /^Needs a decision/u });
    expect(card).toHaveTextContent("3");
    expect(JSON.parse(card.dataset.search ?? "{}")).toMatchObject({
      tab: "catalogue",
      triage: "new",
      minPlayers: 16,
      bucket: "needsDecision",
    });
  });

  it("says there are no warnings when every source is healthy", () => {
    render(<MetaAdminOverviewPage />);

    expect(screen.getByText("No warnings")).toBeInTheDocument();
  });

  it("counts a failed run as a warning", () => {
    captured.statuses.uvsgames = status("uvsgames", {}, [
      run("meta.uvsgames_recheck", { status: "failed", errorMessage: "Upstream returned 503" }),
    ]);

    render(<MetaAdminOverviewPage />);

    expect(screen.getByText("1 warning")).toBeInTheDocument();
    expect(screen.getByText("1 run failed in the last 24 hours.")).toBeInTheDocument();
  });

  it("runs a job from the Run menu", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MetaAdminOverviewPage />);

    await user.click(row("PlayRiftbound").getByRole("menuitem", { name: "Collect results" }));

    expect(captured.run).toHaveBeenCalledWith({ trigger: "runPlayriftboundRecheck" });
  });

  it("asks before applying the auto-publish rule to the backlog", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MetaAdminOverviewPage />);

    await user.click(
      row("PlayRiftbound").getByRole("menuitem", { name: "Apply auto-publish rule" }),
    );
    expect(captured.run).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Apply the rule" }));
    expect(captured.run).toHaveBeenCalledWith({ trigger: "runPlayriftboundAutoAccept" });
  });

  it("offers to stop a job that is running instead of starting it again", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    captured.statuses.uvsgames = status("uvsgames", {}, [
      run("meta.uvsgames_recheck", { status: "running", finishedAt: null }),
    ]);

    render(<MetaAdminOverviewPage />);

    const uvsgames = row("UVS Games");
    expect(uvsgames.queryByRole("menuitem", { name: "Collect results" })).not.toBeInTheDocument();
    await user.click(uvsgames.getByRole("menuitem", { name: "Stop collecting results" }));
    expect(captured.cancel).toHaveBeenCalledWith({ job: "recheck" });
  });
});

describe("MetaAdminOverviewPage source detail", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
    captured.search = { detail: "playriftbound" };
    captured.statuses = { playriftbound: status("playriftbound") };
    captured.schedules = [
      {
        kind: "meta.playriftbound_recheck",
        schedule: "*/10 * * * *",
        nextRun: "2026-10-28T15:00:00.000Z",
      },
    ];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("splits the mirror and the published events into their buckets", () => {
    render(<MetaAdminOverviewPage />);

    expect(screen.getByText("39,089 events")).toBeInTheDocument();
    expect(screen.getByText("skipped, past")).toBeInTheDocument();
    expect(screen.getByText("collecting results")).toBeInTheDocument();
    expect(screen.getByText(/The next starts 2026-10-28 15:30/u)).toBeInTheDocument();
  });

  it("rejects the events that pass the rule without results only after confirming", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MetaAdminOverviewPage />);

    await user.click(screen.getByRole("button", { name: "Reject all" }));
    expect(captured.reject).not.toHaveBeenCalled();
    expect(screen.getByText("Reject 60 events?")).toBeInTheDocument();

    const dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Reject all" }));
    expect(captured.reject).toHaveBeenCalledTimes(1);
  });

  it("runs a job from its own row", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MetaAdminOverviewPage />);

    const collect = screen.getByText("Collect results", { selector: "div" }).closest("tr");
    if (collect === null) {
      throw new Error("No Collect results row");
    }
    await user.click(within(collect).getByRole("button", { name: "Run" }));

    expect(captured.run).toHaveBeenCalledWith({ trigger: "runPlayriftboundRecheck" });
  });

  it("offers Continue and From scratch for a history crawl that stopped early", () => {
    captured.statuses.playriftbound = status("playriftbound", {}, [
      run("meta.playriftbound_backfill", {
        result: { complete: false, cancelRequested: true, rows: 10, coveredThrough: "12" },
      }),
    ]);

    render(<MetaAdminOverviewPage />);

    const history = screen.getByText("Find stores", { selector: "div" }).closest("tr");
    if (history === null) {
      throw new Error("No Find stores row");
    }
    expect(within(history).getByRole("button", { name: "Continue" })).toBeInTheDocument();
    expect(within(history).getByRole("button", { name: "From scratch" })).toBeInTheDocument();
  });

  it("swaps Run for Stop on a job that is running", () => {
    captured.statuses.playriftbound = status("playriftbound", {}, [
      run("meta.playriftbound_backfill", { status: "running", finishedAt: null }),
    ]);

    render(<MetaAdminOverviewPage />);

    const history = screen.getByText("Find stores", { selector: "div" }).closest("tr");
    if (history === null) {
      throw new Error("No Find stores row");
    }
    expect(within(history).getByRole("button", { name: "Stop" })).toBeInTheDocument();
  });

  it("lists each job with its schedule, or Manual when it has none", () => {
    render(<MetaAdminOverviewPage />);

    const collect = screen.getByText("Collect results", { selector: "div" }).closest("tr");
    const findStores = screen.getByText("Find stores", { selector: "div" }).closest("tr");
    expect(collect).toHaveTextContent("*/10 * * * *");
    expect(collect).toHaveTextContent("2026-10-28 15:00");
    expect(findStores).toHaveTextContent("Manual");
  });
});
