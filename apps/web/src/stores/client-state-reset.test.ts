// @vitest-environment jsdom
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { useLocaleBannerStore } from "@/features/account/stores/locale-banner-store";
import { useAdminSettingsStore } from "@/features/admin/stores/admin-settings-store";
import type { BoardDraft } from "@/features/board-states/stores/board-draft-store";
import { useBoardDraftStore } from "@/features/board-states/stores/board-draft-store";
import { useWorkspaceSkipStore } from "@/features/catalog-workspace/stores/workspace-skip-store";
import { usePaletteStore } from "@/features/collections/stores/palette-store";
import { useDeckListPrefsStore } from "@/features/decks/stores/deck-list-prefs-store";
import { useDeckOddsGroupsStore } from "@/features/decks/stores/deck-odds-groups-store";
import { useDeckOverviewViewStore } from "@/features/decks/stores/deck-overview-view-store";
import { useBuyCartStore } from "@/features/groups/stores/buy-cart-store";
import { useTradeAddTargetStore } from "@/features/groups/stores/trade-add-target-store";
import { useTradeTallyStore } from "@/features/groups/stores/trade-tally-store";
import { useMatchTrackerStore } from "@/features/match-tracker/stores/match-tracker-store";
import { appendScanJournal, hasScanJournal } from "@/features/scan/lib/scan-journal";
import { useScanPrefsStore } from "@/features/scan/stores/scan-prefs-store";
import { useScanSessionStore } from "@/features/scan/stores/scan-session-store";
import { useDeckCheckViewStore } from "@/features/tournaments/stores/deck-check-view-store";
import {
  readClientCookie,
  resolvePaletteFromCookie,
  resolveThemeFromCookie,
} from "@/lib/shell-prefs";
import { resolveViewPrefsFromCookie, VIEW_PREFS_COOKIE } from "@/lib/view-prefs";
import { createStoreResetter } from "@/test/store-helpers";

import { CLIENT_STATE, resetClientState } from "./client-state-reset";
import { useDisplayStore } from "./display-store";
import { useInstallStore } from "./install-store";
import { useMilestoneBannerStore } from "./milestone-banner-store";
import { useOnboardingStore } from "./onboarding-store";
import { useSidebarFoldStore } from "./sidebar-fold-store";
import { useThemeStore } from "./theme-store";
import { useCookieViewPrefsStore, useLocalViewPrefsStore } from "./view-prefs-store";

vi.mock("@/features/decks/lib/local-decks-collection", () => ({
  preloadLocalDecks: vi.fn(async () => {}),
  isLocalDeck: (deckId: string) => deckId === "device-deck",
}));

const SRC_DIR = join(import.meta.dirname, "..");

// Writers that persist client state: zustand persist, Web Storage, cookies, TanStack DB local storage, the paraglide locale cookie.
const STORAGE_WRITE =
  /\bpersist\(|\.setItem\(|document\.cookie\s*=(?!=)|localStorageCollectionOptions|\bsetLocale\(/u;

const NOT_STATE = new Set(["lib/cookie-storage.ts", "stores/client-state-reset.ts"]);

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        /\.tsx?$/u.test(entry.name) &&
        !entry.name.includes(".test.") &&
        !entry.name.endsWith(".gen.ts"),
    )
    .map((entry) => relative(SRC_DIR, join(entry.parentPath, entry.name)))
    .filter((path) => !path.startsWith("paraglide/") && !path.startsWith("test/"));
}

const resetters = [
  useLocaleBannerStore,
  useAdminSettingsStore,
  useBoardDraftStore,
  useWorkspaceSkipStore,
  usePaletteStore,
  useDeckListPrefsStore,
  useDeckOddsGroupsStore,
  useDeckOverviewViewStore,
  useBuyCartStore,
  useTradeAddTargetStore,
  useTradeTallyStore,
  useMatchTrackerStore,
  useScanPrefsStore,
  useScanSessionStore,
  useDeckCheckViewStore,
  useDisplayStore,
  useInstallStore,
  useMilestoneBannerStore,
  useOnboardingStore,
  useSidebarFoldStore,
  useThemeStore,
  useCookieViewPrefsStore,
  useLocalViewPrefsStore,
].map((store) => createStoreResetter(store as Parameters<typeof createStoreResetter>[0]));

afterEach(() => {
  for (const reset of resetters) {
    reset();
  }
  localStorage.clear();
  sessionStorage.clear();
});

async function resetBothPhases(): Promise<void> {
  await resetClientState("before-leave");
  await resetClientState("after-leave");
}

describe("CLIENT_STATE", () => {
  it("classifies every file that writes persisted client state", async () => {
    const writers: string[] = [];
    for (const path of await sourceFiles(SRC_DIR)) {
      if (
        !NOT_STATE.has(path) &&
        STORAGE_WRITE.test(await readFile(join(SRC_DIR, path), "utf-8"))
      ) {
        writers.push(path);
      }
    }
    const classified = new Set(
      CLIENT_STATE.filter((entry) => entry.storage !== "memory").flatMap((entry) => entry.sources),
    );

    expect(
      writers.filter((path) => !classified.has(path)).toSorted(),
      "A file writes client storage without an entry in CLIENT_STATE. Add one that resets it on sign-out, or keeps it with a reason.",
    ).toEqual([]);
    expect([...classified].filter((path) => !writers.includes(path)).toSorted()).toEqual([]);
  });

  it("lists every persisted store name under its file's entries", async () => {
    const missing: string[] = [];
    for (const path of new Set(CLIENT_STATE.flatMap((entry) => entry.sources))) {
      const contents = await readFile(join(SRC_DIR, path), "utf-8");
      if (!/\bpersist\(/u.test(contents)) {
        continue;
      }
      const keys = new Set(
        CLIENT_STATE.filter((entry) => entry.sources.includes(path)).flatMap((entry) => entry.keys),
      );
      for (const match of contents.matchAll(/\bname:\s*"(?<name>[^"]+)"/gu)) {
        const name = match.groups!.name!;
        if (!keys.has(name)) {
          missing.push(`${path}: ${name}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("points only at files that exist", () => {
    for (const entry of CLIENT_STATE) {
      for (const source of entry.sources) {
        expect(existsSync(join(SRC_DIR, source)), source).toBe(true);
      }
    }
  });

  it("gives every kept entry a reason", () => {
    for (const entry of CLIENT_STATE) {
      if ("keep" in entry) {
        expect(entry.keep.length, entry.keys.join(",")).toBeGreaterThan(20);
      }
    }
  });

  it("resets the shell cookies before leaving the signed-in page", () => {
    const beforeLeave = CLIENT_STATE.filter(
      (entry) => "phase" in entry && entry.phase === "before-leave",
    ).flatMap((entry) => entry.keys);

    expect(beforeLeave).toEqual(expect.arrayContaining(["theme", "palette", VIEW_PREFS_COOKIE]));
  });
});

describe("resetClientState", () => {
  it("leaves cookies that the next page load resolves to the default shell", async () => {
    useThemeStore.getState().setTheme("light");
    usePaletteStore.getState().setPalette("minimal");
    useCookieViewPrefsStore.getState().setSortDir("cards", "desc");

    await resetClientState("before-leave");

    expect(resolveThemeFromCookie(readClientCookie("theme"))).toBe(resolveThemeFromCookie(null));
    expect(resolvePaletteFromCookie(readClientCookie("palette"))).toBe(
      resolvePaletteFromCookie(null),
    );
    expect(resolveViewPrefsFromCookie(readClientCookie(VIEW_PREFS_COOKIE))).toEqual(
      resolveViewPrefsFromCookie(null),
    );
    expect(document.documentElement.classList.contains("dark")).toBe(
      resolveThemeFromCookie(null) === "dark",
    );
    expect(document.documentElement.dataset.palette).toBe(resolvePaletteFromCookie(null));
  });

  it("resets every display setting but keeps the preferences-loaded flag", async () => {
    useDisplayStore.getState().setDisplayMode("table");
    useDisplayStore.getState().setFrostedBars(true);
    useDisplayStore.getState().markPrefsHydrated();

    await resetClientState("before-leave");

    const initial = useDisplayStore.getInitialState();
    expect(useDisplayStore.getState().displayMode).toBe(initial.displayMode);
    expect(useDisplayStore.getState().frostedBars).toBe(initial.frostedBars);
    expect(document.documentElement.dataset.frosted).toBeUndefined();
    expect(useDisplayStore.getState().prefsHydrated).toBe(true);
  });

  it("clears the signed-out account's data and device choices", async () => {
    useOnboardingStore.getState().dismissIntro("stage");
    useMilestoneBannerStore.getState().dismiss("2026-11-01");
    useSidebarFoldStore.getState().setOpen("shared:group-1", false);
    document.cookie = "sidebar_state=false; path=/";
    useLocaleBannerStore.getState().dismiss();
    useAdminSettingsStore.getState().update({ debugOverlay: true });
    localStorage.setItem("openrift.design.specs", "1");
    useWorkspaceSkipStore.getState().skip("card", "card-1");
    useScanPrefsStore.getState().setDestinationCollectionId("collection-1");
    useScanSessionStore.setState({ scans: 4, lastScanAt: 1 });
    appendScanJournal({ type: "reload-prompt" });
    useDeckCheckViewStore.getState().setWide(false);
    useDeckOverviewViewStore.getState().setDisplayMode("list");
    useDeckListPrefsStore.getState().setDensity("list");
    useLocalViewPrefsStore.getState().setSortDir("decks", "asc");
    useBoardDraftStore.setState({ draft: { title: "Draft" } as BoardDraft });
    useBuyCartStore.getState().setMarketplace("cardmarket");
    useBuyCartStore
      .getState()
      .addItems("friend-1", [{ key: "k1", cardId: "c1", printingId: "p1", quantity: 2 }]);
    useTradeTallyStore.getState().setCount("trade-1", 1);
    useTradeAddTargetStore.getState().setTarget({ id: "list-1", name: "Binder" });
    useMatchTrackerStore.getState().startGame();
    sessionStorage.setItem('openrift-settlement:["user-1","trade-1","x"]', "request-1");

    await resetBothPhases();

    expect(useOnboardingStore.getState().dismissedIntros).toEqual([]);
    expect(useMilestoneBannerStore.getState().dismissedDate).toBeNull();
    expect(useSidebarFoldStore.getState().byKey["shared:group-1"]).toBeUndefined();
    expect(readClientCookie("sidebar_state")).toBeNull();
    expect(useLocaleBannerStore.getState().dismissed).toBe(false);
    expect(useAdminSettingsStore.getState().settings.debugOverlay).toBe(false);
    expect(localStorage.getItem("openrift.design.specs")).toBeNull();
    expect(useWorkspaceSkipStore.getState().skipped).toEqual({});
    expect(useScanPrefsStore.getState().destinationCollectionId).toBeNull();
    expect(useScanSessionStore.getState().scans).toBe(0);
    expect(hasScanJournal()).toBe(false);
    expect(useDeckCheckViewStore.getState().wide).toBe(true);
    expect(useDeckOverviewViewStore.getState().displayMode).toBe("grid");
    expect(useDeckListPrefsStore.getState().density).toBe("grid");
    expect(useLocalViewPrefsStore.getState().decks.sortDir).toBe("desc");
    expect(useBoardDraftStore.getState().draft).toBeNull();
    expect(useBuyCartStore.getState()).toMatchObject(useBuyCartStore.getInitialState());
    expect(useTradeTallyStore.getState().counts).toEqual({});
    expect(useTradeAddTargetStore.getState().target).toBeNull();
    expect(useMatchTrackerStore.getState().status).toBe("setup");
    expect(sessionStorage.length).toBe(0);
  });

  it("keeps draw-odds groups of decks that live on this device", async () => {
    useDeckOddsGroupsStore.getState().setSelection("device-deck", ["units"]);
    useDeckOddsGroupsStore.getState().setSelection("account-deck", ["spells"]);
    useDeckOddsGroupsStore
      .getState()
      .addCustomGroup("account-deck", { key: "custom-1", label: "Removal" });

    await resetClientState("after-leave");

    expect(useDeckOddsGroupsStore.getState().selectionByDeck).toEqual({ "device-deck": ["units"] });
    expect(useDeckOddsGroupsStore.getState().customByDeck).toEqual({});
  });

  it("keeps device state that never belonged to the account", async () => {
    useInstallStore.setState({ visitDays: 3, installedToastShown: true });
    localStorage.setItem("openrift-local-decks-v2", "{}");
    localStorage.setItem("umami.disabled", "1");
    sessionStorage.setItem("openrift:reload-attempted", "1");

    await resetBothPhases();

    expect(useInstallStore.getState().visitDays).toBe(3);
    expect(useInstallStore.getState().installedToastShown).toBe(true);
    expect(localStorage.getItem("openrift-local-decks-v2")).toBe("{}");
    expect(localStorage.getItem("umami.disabled")).toBe("1");
    expect(sessionStorage.getItem("openrift:reload-attempted")).toBe("1");
  });

  it("runs the remaining resets when one fails", async () => {
    useMilestoneBannerStore.getState().dismiss("2026-11-01");
    vi.spyOn(useOnboardingStore, "setState").mockImplementationOnce(() => {
      throw new Error("Storage full");
    });

    await expect(resetClientState("after-leave")).resolves.toBeUndefined();

    expect(useMilestoneBannerStore.getState().dismissedDate).toBeNull();
    vi.restoreAllMocks();
  });
});
