import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { userId, failed, useCollections, addAll } = vi.hoisted(() => ({
  userId: { current: null as string | null },
  failed: { count: 0 },
  useCollections: vi.fn(() => ({ data: [] })),
  addAll: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search,
  }: {
    children: ReactNode;
    to: string;
    search?: { redirect?: string };
  }) => <a href={`${to}?redirect=${search?.redirect ?? ""}`}>{children}</a>,
}));

vi.mock("@/hooks/use-session", () => ({
  useUserId: () => userId.current,
  useSession: () => ({ data: null }),
}));
vi.mock("@/features/collections/hooks/use-collections", () => ({ useCollections }));
vi.mock("@/features/collections/components/take-wishlist-followup-dialog", () => ({
  TakeWishlistFollowUpDialog: () => null,
}));
vi.mock("@/features/cards/components/card-detail-opener", () => ({
  CardDetailOverlayProvider: ({ children }: { children: ReactNode }) => children,
  useOpenCardDetail: () => null,
}));
vi.mock("@/features/cards/hooks/use-cards", () => ({ useCards: () => ({ allPrintings: [] }) }));
vi.mock("@/features/scan/hooks/use-scan-bank", () => ({
  useScanBank: () => ({ assets: null, labels: null, unavailableMessage: null }),
}));
vi.mock("@/features/scan/hooks/use-scan-engine", () => ({
  useScanEngine: () => ({ bank: null, engineReady: false, slowDevice: false, progress: null }),
}));
vi.mock("@/features/scan/hooks/use-card-scanner", () => ({
  useCardScanner: () => ({
    videoRef: { current: null },
    overlayRef: { current: null },
    active: false,
    error: null,
    readout: { aim: null, aimHint: null, bestScore: 0, lockProgress: 0 },
    start: vi.fn(),
    stop: vi.fn(),
    capture: vi.fn(),
    identifyNow: vi.fn(),
    unidentified: [],
    dismissUnidentified: vi.fn(),
  }),
}));
vi.mock("@/features/scan/hooks/use-scan-identify", () => ({
  useScanIdentify: () => ({
    open: false,
    snapshot: null,
    pending: false,
    candidates: [],
    run: vi.fn(),
    dismiss: vi.fn(),
    pick: vi.fn(),
    pickPrinting: vi.fn(),
    answerMissed: vi.fn(),
  }),
}));
vi.mock("@/features/scan/hooks/use-scan-aim-identify", () => ({ useScanAimIdentify: vi.fn() }));
vi.mock("@/features/scan/hooks/use-scan-session-restore", () => ({
  useScanSessionRestore: vi.fn(),
}));
vi.mock("@/features/scan/hooks/use-scan-layout", () => ({ useScanLayout: () => "boxed" }));
vi.mock("@/features/scan/hooks/use-scan-add", () => ({
  useScanAdd: () => ({
    adding: false,
    failedCount: failed.count,
    resetFailedCount: vi.fn(),
    addAll,
    followUp: null,
    dismissFollowUp: vi.fn(),
  }),
}));
vi.mock("@/features/scan/components/scan-stage", () => ({
  ScanStage: ({ tray }: { tray: ReactNode }) => <div>{tray}</div>,
}));
vi.mock("@/features/scan/components/scan-top-bar", () => ({ ScanTopBar: () => null }));
vi.mock("@/features/scan/components/scan-flight-layer", () => ({ ScanFlightLayer: () => null }));
vi.mock("@/features/scan/components/scan-identify-sheet", () => ({
  ScanIdentifySheet: () => null,
}));
vi.mock("@/features/scan/components/scan-printing-picker", () => ({
  ScanPrintingPicker: () => null,
}));

import { ScanPage } from "@/features/scan/components/scan-page";
import { useScanSessionStore } from "@/features/scan/stores/scan-session-store";
import { initKeys } from "@/lib/query-keys";
import { stubPrinting } from "@/test/factories";
import { stubInitResponse } from "@/test/init-fixtures";
import { createStoreResetter } from "@/test/store-helpers";

const resetSession = createStoreResetter(useScanSessionStore);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(initKeys.all, stubInitResponse());
  return render(
    <QueryClientProvider client={client}>
      <ScanPage />
    </QueryClientProvider>,
  );
}

describe("ScanPage", () => {
  beforeEach(() => {
    resetSession();
    useCollections.mockClear();
    addAll.mockClear();
    failed.count = 0;
  });
  afterEach(resetSession);

  it("renders for a signed-out visitor without reading collections", () => {
    userId.current = null;
    useScanSessionStore.getState().add(stubPrinting({ printingId: "p-1" }));
    renderPage();

    expect(useCollections).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /add 1 card to a collection/iu })).toBeEnabled();
  });

  it("asks a signed-out visitor to sign in and comes back to /scan", () => {
    userId.current = null;
    useScanSessionStore.getState().add(stubPrinting({ printingId: "p-1" }));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /add 1 card to a collection/iu }));

    expect(addAll).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /sign in/iu })).toHaveAttribute(
      "href",
      "/login?redirect=/scan",
    );
    expect(useScanSessionStore.getState().rows.size).toBe(1);
  });

  it("reads the signed-in user's collections", () => {
    userId.current = "user-1";
    renderPage();

    expect(useCollections).toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: /sign in/iu })).toBeNull();
  });

  it("hides an earlier account's unfinished add from a signed-out visitor", () => {
    userId.current = null;
    failed.count = 2;
    useScanSessionStore.getState().add(stubPrinting({ printingId: "p-1" }));
    renderPage();

    expect(screen.queryByText(/could not add/iu)).toBeNull();
  });
});
