import type { MetaCatalogRow, MetaSyncStatus } from "@openrift/shared/contracts/admin/meta-catalog";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MirrorCounts } from "@/features/admin/lib/meta-mirror-view";
import { useMetaMirrorSelectionStore } from "@/features/admin/stores/meta-mirror-selection-store";
import { createStoreResetter } from "@/test/store-helpers";

const captured = vi.hoisted(() => ({
  search: {} as Record<string, unknown>,
  rows: [] as unknown[],
  buckets: null as unknown,
  status: undefined as unknown,
  params: null as unknown,
  bulkReject: vi.fn(),
  bulkPublish: vi.fn(),
  publish: vi.fn(),
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
    useSearch: () => captured.search,
    useNavigate: () => vi.fn(),
  }),
  createLink: (component: unknown) => component,
}));

vi.mock("@/features/admin/components/admin-page-top-bar", () => ({
  AdminPageTopBar: ({ actions }: { actions?: ReactNode }) => <div>{actions}</div>,
}));

vi.mock("@/features/admin/components/meta-run-menu", () => ({ MetaRunMenu: () => null }));
vi.mock("@/features/admin/components/meta-auto-accept-dialog", () => ({
  MetaAutoAcceptDialog: () => null,
}));
vi.mock("@/features/admin/components/meta-source-vocabulary-dialog", () => ({
  MetaSourceVocabularyDialog: () => null,
}));

vi.mock("@/features/admin/hooks/use-admin-meta-catalog", () => ({
  useMetaSyncStatus: () => ({ data: captured.status }),
  useMetaSyncSettings: () => ({
    data: {
      autoAcceptMinPlayers: 16,
      autoAcceptOfficial: true,
      autoAcceptNotable: false,
      competitivePlayerFloor: 64,
      updatedAt: "2026-09-18T22:06:00.000Z",
    },
  }),
}));

vi.mock("@/features/admin/hooks/use-admin-meta-mirror", () => {
  const mutation = (fn: Mock<(vars: unknown) => unknown>) => () => ({
    mutate: (vars: unknown, options?: { onSuccess?: (data: unknown) => void }) => {
      fn(vars);
      options?.onSuccess?.(fn.mock.results.at(-1)?.value);
    },
    mutateAsync: (vars: unknown) => Promise.resolve(fn(vars)),
    isPending: false,
  });
  return {
    META_MIRROR_PAGE_SIZE: 50,
    useMetaMirror: (params: { source: string }) => {
      captured.params = params;
      return {
        data: {
          source: params.source,
          data: { rows: captured.rows, total: captured.rows.length, buckets: captured.buckets },
        },
      };
    },
    usePublishMirrorRow: mutation(captured.publish),
    useRejectMirrorRow: mutation(vi.fn()),
    useRestoreMirrorRow: mutation(vi.fn()),
    useCollectMirrorRow: mutation(vi.fn()),
    useBulkPublishMirror: mutation(captured.bulkPublish),
    useBulkRejectMirror: mutation(captured.bulkReject),
    useBulkRestoreMirror: mutation(vi.fn()),
    useBulkUnpublishMirror: mutation(vi.fn()),
  };
});

vi.mock("@/hooks/use-enums", () => ({
  useDeckFormatList: () => ({ formats: [], labels: { constructed: "Constructed" } }),
}));

vi.mock("@/hooks/use-mounted-at", () => ({
  useMountedAt: () => new Date("2026-10-28T17:00:00.000Z"),
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { MetaMirrorPage } from "./meta-mirror-page";

const STATUS_COUNTS: MirrorCounts = {
  needsDecision: 2,
  passingNoResults: 2,
  skippedUpcoming: 8833,
  skippedPast: 246_948,
  notStarted: 5,
  collecting: 686,
  final: 47_225,
  noResults: 604,
  undecided: 255_785,
  published: 48_520,
  rejected: 0,
  total: 304_305,
};

function status(): MetaSyncStatus {
  const { undecided, published, rejected, total, ...buckets } = STATUS_COUNTS;
  return {
    catalog: {
      ...buckets,
      total,
      completed: 0,
      decklistPublished: 0,
      missing: 0,
      queued: 0,
      dueRecheck: 0,
      oldestDueAt: null,
      acceptedAwaitingResults: 0,
      acceptedMissing: 0,
      acceptedCancelled: 0,
      lastSeenAt: "2026-10-28T06:00:00.000Z",
      firstStartAt: null,
      nextCheckAt: null,
    },
    archive: {
      events: 0,
      eventsWithStandings: 0,
      eventsWithDecklists: 0,
      decks: 0,
      addedLast7Days: 0,
    },
    counts: { new: undecided, accepted: published, dismissed: rejected },
    runs: [],
    schedules: {},
  };
}

function row(overrides: Partial<MetaCatalogRow> = {}): MetaCatalogRow {
  return {
    externalId: "923368",
    name: "LAI LA NIU LAI CMC TUESDAY NEXUS NIGHT 1v1",
    startAt: "2026-09-08T12:30:00.000Z",
    endAtEstimate: null,
    displayStatus: "complete",
    decklistStatus: null,
    playerCount: 26,
    eventType: null,
    eventFormat: "Constructed",
    mappedFormat: "constructed",
    officialLabel: null,
    storeName: "CARD MASTER CLUB",
    location: null,
    timezone: null,
    firstSeenAt: "2026-09-01T00:00:00.000Z",
    lastSeenAt: "2026-10-28T06:00:00.000Z",
    missingSince: null,
    missingProbe: null,
    nextCheckAt: null,
    checkStage: 0,
    triage: "new",
    metaEventId: null,
    metaEventSlug: null,
    fetchedAt: null,
    stagedPlayerCount: 0,
    stagedLegendCount: 0,
    stagedDeckCount: 0,
    sourceUrl: "https://example.invalid/events/923368",
    ...overrides,
  };
}

const resetSelection = createStoreResetter(useMetaMirrorSelectionStore);

describe("MetaMirrorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.search = {};
    captured.rows = [row()];
    captured.buckets = null;
    captured.status = status();
  });

  afterEach(() => {
    resetSelection();
  });

  it("opens on the events that need a decision, filtered by the stored rule", () => {
    render(<MetaMirrorPage />);

    expect(captured.params).toMatchObject({
      source: "uvsgames",
      triage: "new",
      bucket: "needsDecision",
    });
    expect(captured.params).not.toHaveProperty("minPlayers", 16);
    expect(screen.getByRole("heading", { name: "Needs a decision" })).toBeInTheDocument();
  });

  it("states the source's rule from the stored settings", () => {
    render(<MetaMirrorPage />);

    expect(
      screen.getByText(
        "Auto-publish: 16+ players or a watched event type, with a mapped format. Cancelled events never publish.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the Overview's counts on the rail while no filter narrows the list", () => {
    render(<MetaMirrorPage />);

    const rail = screen.getByRole("navigation", { name: "Mirror states" });
    expect(within(rail).getByText("Skipped, past").parentElement).toHaveTextContent("246,948");
    expect(within(rail).getByText("Collecting results").parentElement).toHaveTextContent("686");
  });

  it("counts under the list's filters once one narrows it", () => {
    captured.search = { q: "nexus" };
    captured.buckets = { ...STATUS_COUNTS, needsDecision: 1 };

    render(<MetaMirrorPage />);

    const rail = screen.getByRole("navigation", { name: "Mirror states" });
    expect(within(rail).getByText("Needs a decision").parentElement).toHaveTextContent(
      /^Needs a decision1$/u,
    );
  });

  it("says n/a for collecting on a source that never collects", () => {
    captured.search = { source: "topdeck" };
    captured.rows = [];

    render(<MetaMirrorPage />);

    const rail = screen.getByRole("navigation", { name: "Mirror states" });
    expect(within(rail).getByText("Collecting results").parentElement).toHaveTextContent("n/a");
  });

  it("rejects the ticked rows only after confirming", async () => {
    const user = userEvent.setup();
    captured.bulkReject.mockReturnValue({ rejected: ["923368"] });

    render(<MetaMirrorPage />);
    await user.click(screen.getByRole("checkbox", { name: /^Select LAI LA NIU/u }));
    await user.click(screen.getByRole("button", { name: "Reject 1" }));
    expect(captured.bulkReject).not.toHaveBeenCalled();

    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Reject 1" }),
    );

    expect(captured.bulkReject).toHaveBeenCalledWith({ source: "uvsgames", keys: ["923368"] });
  });

  it("asks for a format before publishing an event whose format maps to nothing", async () => {
    const user = userEvent.setup();
    captured.rows = [row({ mappedFormat: null, eventFormat: "Draft" })];

    render(<MetaMirrorPage />);
    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect(captured.publish).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent(/calls it "Draft"/u);
  });

  it("shows a published row's results apart from where it is, with no selection", () => {
    captured.search = { bucket: "collecting" };
    captured.rows = [
      row({
        triage: "accepted",
        metaEventId: "live-1",
        displayStatus: "inProgress",
        nextCheckAt: "2026-10-28T17:50:00.000Z",
        stagedPlayerCount: 16,
      }),
    ];

    render(<MetaMirrorPage />);

    const table = screen.getByRole("table");
    expect(within(table).getByText("Published")).toBeInTheDocument();
    expect(within(table).getByText("Collecting results")).toBeInTheDocument();
    expect(screen.getByText("16 standings, next check 2026-10-28 17:50")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collect results" })).toBeInTheDocument();
  });
});
