import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  userId,
  failed,
  useCollections,
  addAll,
  serving,
  engineLoadError,
  scannerSettings,
  scanner,
  layout,
  route,
  stage,
} = vi.hoisted(() => ({
  scanner: { start: vi.fn(), stop: vi.fn(), active: false },
  layout: { current: "boxed" as "boxed" | "portrait" | "landscape" },
  route: {
    cameraScreen: false,
    navigate: vi.fn(),
    back: vi.fn(),
    entryState: {} as Record<string, unknown>,
    listeners: [] as ((event: {
      fromLocation?: { pathname: string };
      toLocation: { pathname: string };
    }) => void)[],
  },
  stage: {
    current: null as {
      layout: string;
      immersive: boolean;
      fullscreen: boolean;
      viewfinder: ReactElement<{ onStart: () => void }>;
      chrome: ReactElement<{ stoppable: boolean; onStop: () => void }>;
    } | null,
  },
  scannerSettings: vi.fn(),
  userId: { current: null as string | null },
  serving: {
    current: { status: "loading", assets: null } as { status: string; assets: null },
  },
  engineLoadError: { current: null as string | null },
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
  useLocation: (opts?: { select?: (location: { href: string }) => unknown }) => {
    const location = { href: "/scan" };
    return opts?.select ? opts.select(location) : location;
  },
  useMatch: () => (route.cameraScreen ? true : undefined),
  useNavigate: () => route.navigate,
  useRouter: () => ({
    latestLocation: { state: route.entryState },
    history: { back: route.back },
    subscribe: (_type: string, listener: (typeof route.listeners)[number]) => {
      route.listeners.push(listener);
      return () => {
        route.listeners = route.listeners.filter((entry) => entry !== listener);
      };
    },
  }),
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
vi.mock("@/features/scan/hooks/use-scan-serving", () => ({
  useScanServing: () => serving.current,
}));
vi.mock("@/features/scan/hooks/use-scan-engine", () => ({
  useScanEngine: () => ({
    bank: null,
    engineReady: false,
    slowDevice: false,
    progress: {
      encoder: { loaded: 0, total: 0, ready: false },
      bank: { loaded: 0, total: 0, ready: false },
    },
    loadError: engineLoadError.current,
  }),
}));
vi.mock("@/features/scan/hooks/use-card-scanner", () => ({
  useCardScanner: (_engine: unknown, settings: unknown) => {
    scannerSettings(settings);
    return {
      videoRef: { current: null },
      overlayRef: { current: null },
      active: scanner.active,
      error: null,
      readout: { aim: null, aimHint: null, bestScore: 0, lockProgress: 0 },
      start: scanner.start,
      stop: scanner.stop,
      capture: vi.fn(),
      identifyNow: vi.fn(),
      unidentified: [],
      dismissUnidentified: vi.fn(),
    };
  },
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
vi.mock("@/features/scan/hooks/use-scan-layout", () => ({ useScanLayout: () => layout.current }));
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
  ScanStage: (props: {
    layout: string;
    immersive: boolean;
    fullscreen: boolean;
    viewfinder: ReactElement<{ onStart: () => void }>;
    chrome: ReactElement<{ stoppable: boolean; onStop: () => void }>;
    tray: ReactNode;
    notices: ReactNode;
  }) => {
    stage.current = props;
    return (
      <div>
        {props.viewfinder}
        {props.notices}
        {props.tray}
      </div>
    );
  },
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
import { useScanPrefsStore } from "@/features/scan/stores/scan-prefs-store";
import { useScanSessionStore } from "@/features/scan/stores/scan-session-store";
import { initKeys } from "@/lib/query-keys";
import { stubPrinting } from "@/test/factories";
import { stubInitResponse } from "@/test/init-fixtures";
import { createStoreResetter } from "@/test/store-helpers";

const resetSession = createStoreResetter(useScanSessionStore);
const resetPrefs = createStoreResetter(useScanPrefsStore);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(initKeys.all, stubInitResponse());
  const page = () => (
    <QueryClientProvider client={client}>
      <ScanPage />
    </QueryClientProvider>
  );
  const view = render(page());
  return { ...view, rerenderPage: () => view.rerender(page()) };
}

describe("ScanPage", () => {
  beforeEach(() => {
    resetSession();
    useCollections.mockClear();
    addAll.mockClear();
    failed.count = 0;
    serving.current = { status: "loading", assets: null };
    engineLoadError.current = null;
  });
  afterEach(() => {
    resetSession();
    resetPrefs();
  });

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

  it("shows the unavailable state when the engine assets fail to load", () => {
    userId.current = null;
    engineLoadError.current = "Could not load the scan labels from /media/scan/labels.json";
    renderPage();

    expect(
      screen.getByText("The scanner is not available right now. Please try again later."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/media\/scan/u)).toBeNull();
    expect(screen.queryByText("Getting the scanner ready")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("shows the loader while the engine loads", () => {
    userId.current = null;
    renderPage();

    expect(screen.getByText("Getting the scanner ready")).toBeInTheDocument();
    expect(screen.queryByText(/not available right now/u)).toBeNull();
  });

  it("shows the unavailable state when nothing is published", () => {
    userId.current = null;
    serving.current = { status: "unavailable", assets: null };
    renderPage();

    expect(
      screen.getByText("The scanner is not available right now. Please try again later."),
    ).toBeInTheDocument();
  });

  it("hands the stored zoom to the scanner from the first render on", () => {
    userId.current = null;
    useScanPrefsStore.getState().setZoom(2);
    scannerSettings.mockClear();
    renderPage();

    const zooms = scannerSettings.mock.calls.map(
      ([settings]) => (settings as { zoom: number }).zoom,
    );
    expect(zooms.length).toBeGreaterThan(0);
    expect(zooms.every((zoom) => zoom === 2)).toBe(true);
  });
});

describe("ScanPage camera screen", () => {
  beforeEach(() => {
    userId.current = null;
    scanner.start.mockClear();
    scanner.stop.mockClear();
    scanner.active = false;
    layout.current = "portrait";
    route.cameraScreen = false;
    route.navigate.mockClear();
    route.back.mockClear();
    route.entryState = {};
    route.listeners = [];
  });
  afterEach(() => {
    layout.current = "boxed";
    route.cameraScreen = false;
  });

  it("opens the camera screen as it starts the camera on a phone", () => {
    renderPage();

    act(() => stage.current?.viewfinder.props.onStart());

    expect(scanner.start).toHaveBeenCalledOnce();
    expect(route.navigate).toHaveBeenCalledWith(expect.objectContaining({ to: "/scan/camera" }));
  });

  it("starts the camera in place on a wide screen", () => {
    layout.current = "boxed";
    renderPage();

    act(() => stage.current?.viewfinder.props.onStart());

    expect(scanner.start).toHaveBeenCalledOnce();
    expect(route.navigate).not.toHaveBeenCalled();
  });

  it("goes full screen on the camera route and offers a way out before the camera runs", () => {
    route.cameraScreen = true;
    renderPage();

    expect(stage.current?.fullscreen).toBe(true);
    expect(stage.current?.chrome.props.stoppable).toBe(true);
  });

  it("goes full screen on the camera route in the boxed layout", () => {
    layout.current = "boxed";
    route.cameraScreen = true;
    renderPage();

    expect(stage.current?.fullscreen).toBe(true);
    expect(stage.current?.immersive).toBe(true);
    expect(stage.current?.layout).not.toBe("boxed");
  });

  it("keeps the boxed page on /scan in the boxed layout", () => {
    layout.current = "boxed";
    renderPage();

    expect(stage.current?.fullscreen).toBe(false);
    expect(stage.current?.layout).toBe("boxed");
  });

  it("goes back from a reloaded camera screen it opened", () => {
    route.entryState = { scanCameraEntry: true };
    route.cameraScreen = true;
    renderPage();

    act(() => stage.current?.chrome.props.onStop());

    expect(route.back).toHaveBeenCalledOnce();
    expect(route.navigate).not.toHaveBeenCalled();
  });

  it("closes the camera screen it opened by going back", () => {
    const { rerenderPage } = renderPage();
    act(() => stage.current?.viewfinder.props.onStart());
    const pushed = route.navigate.mock.calls[0]?.[0] as {
      state: (previous: Record<string, unknown>) => Record<string, unknown>;
    };
    route.entryState = pushed.state({});
    route.cameraScreen = true;
    scanner.active = true;
    rerenderPage();

    act(() => stage.current?.chrome.props.onStop());

    expect(route.back).toHaveBeenCalledOnce();
  });

  it("replaces a camera screen that was loaded directly with /scan", () => {
    route.cameraScreen = true;
    renderPage();

    act(() => stage.current?.chrome.props.onStop());

    expect(route.back).not.toHaveBeenCalled();
    expect(route.navigate).toHaveBeenCalledWith({ to: "/scan", replace: true });
  });

  it("stops the camera when a navigation leaves the camera screen", () => {
    route.cameraScreen = true;
    scanner.active = true;
    renderPage();

    act(() => {
      for (const listener of route.listeners) {
        listener({ fromLocation: { pathname: "/scan/camera" }, toLocation: { pathname: "/scan" } });
      }
    });

    expect(scanner.stop).toHaveBeenCalled();
  });

  it("keeps the camera running on the way into the camera screen", () => {
    renderPage();

    act(() => {
      for (const listener of route.listeners) {
        listener({ fromLocation: { pathname: "/scan" }, toLocation: { pathname: "/scan/camera" } });
      }
    });

    expect(scanner.stop).not.toHaveBeenCalled();
  });
});
