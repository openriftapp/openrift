import type { StoreApi } from "zustand";

import { useLocaleBannerStore } from "@/features/account/stores/locale-banner-store";
import { useAdminSettingsStore } from "@/features/admin/stores/admin-settings-store";
import { useBoardDraftStore } from "@/features/board-states/stores/board-draft-store";
import { useWorkspaceSkipStore } from "@/features/catalog-workspace/stores/workspace-skip-store";
import { useAddModeStore } from "@/features/collections/stores/add-mode-store";
import { usePaletteStore } from "@/features/collections/stores/palette-store";
import { isLocalDeck, preloadLocalDecks } from "@/features/decks/lib/local-decks-collection";
import { useDeckBuilderUiStore } from "@/features/decks/stores/deck-builder-ui-store";
import { useDeckListPrefsStore } from "@/features/decks/stores/deck-list-prefs-store";
import { useDeckOddsGroupsStore } from "@/features/decks/stores/deck-odds-groups-store";
import { useDeckOverviewViewStore } from "@/features/decks/stores/deck-overview-view-store";
import { clearTradeSettlementRequests } from "@/features/groups/lib/trade-settlement-request";
import { useBuyCartStore } from "@/features/groups/stores/buy-cart-store";
import { useTradeAddTargetStore } from "@/features/groups/stores/trade-add-target-store";
import { useTradeTallyStore } from "@/features/groups/stores/trade-tally-store";
import { useMatchTrackerStore } from "@/features/match-tracker/stores/match-tracker-store";
import { clearScanJournal } from "@/features/scan/lib/scan-journal";
import { useScanPrefsStore } from "@/features/scan/stores/scan-prefs-store";
import { useScanSessionStore } from "@/features/scan/stores/scan-session-store";
import { useDeckCheckViewStore } from "@/features/tournaments/stores/deck-check-view-store";
import { cookieStorage } from "@/lib/cookie-storage";
import { captureHandledError } from "@/lib/report-error";
import { useDisplayStore } from "@/stores/display-store";
import { useMilestoneBannerStore } from "@/stores/milestone-banner-store";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useSidebarFoldStore } from "@/stores/sidebar-fold-store";
import { useThemeStore } from "@/stores/theme-store";
import { useCookieViewPrefsStore, useLocalViewPrefsStore } from "@/stores/view-prefs-store";

// "before-leave" runs before the post-sign-out navigation (root beforeLoad reads those
// cookies), "after-leave" once the signed-in page has unmounted and flushed its writes.
export type ResetPhase = "before-leave" | "after-leave";

type StorageKind = "localStorage" | "sessionStorage" | "cookie" | "memory";

interface ResetEntry {
  sources: readonly string[];
  storage: StorageKind;
  keys: readonly string[];
  phase: ResetPhase;
  reset: () => void | Promise<void>;
}

interface KeepEntry {
  sources: readonly string[];
  storage: StorageKind;
  keys: readonly string[];
  keep: string;
}

export type ClientStateEntry = ResetEntry | KeepEntry;

function resetToInitial<State>(store: StoreApi<State>): void {
  store.setState(store.getInitialState(), true);
}

function removeLocalItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage blocked: nothing was written either.
  }
}

async function keepLocalDeckOddsGroups(): Promise<void> {
  await preloadLocalDecks();
  const { selectionByDeck, customByDeck } = useDeckOddsGroupsStore.getState();
  const local = (byDeck: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(byDeck).filter(([deckId]) => isLocalDeck(deckId)));
  useDeckOddsGroupsStore.setState({
    selectionByDeck: local(selectionByDeck) as Record<string, string[]>,
    customByDeck: local(customByDeck) as typeof customByDeck,
  });
}

/** Paths are relative to `apps/web/src`. */
export const CLIENT_STATE: readonly ClientStateEntry[] = [
  {
    sources: ["stores/theme-store.ts"],
    storage: "cookie",
    keys: ["theme"],
    phase: "before-leave",
    reset: () => useThemeStore.getState().reset(),
  },
  {
    sources: ["features/collections/stores/palette-store.ts"],
    storage: "cookie",
    keys: ["palette"],
    phase: "before-leave",
    reset: () => usePaletteStore.getState().reset(),
  },
  {
    sources: ["stores/view-prefs-store.ts"],
    storage: "cookie",
    keys: ["view-prefs"],
    phase: "before-leave",
    reset: () => resetToInitial(useCookieViewPrefsStore),
  },
  {
    sources: ["stores/view-prefs-store.ts"],
    storage: "localStorage",
    keys: ["view-prefs-local"],
    phase: "before-leave",
    reset: () => resetToInitial(useLocalViewPrefsStore),
  },
  {
    sources: ["stores/display-store.ts"],
    storage: "localStorage",
    keys: ["user-preferences"],
    phase: "before-leave",
    reset: () => {
      useDisplayStore.setState(
        {
          ...useDisplayStore.getInitialState(),
          prefsHydrated: useDisplayStore.getState().prefsHydrated,
        },
        true,
      );
    },
  },
  {
    sources: ["features/collections/stores/add-mode-store.ts"],
    storage: "memory",
    keys: [],
    phase: "before-leave",
    reset: () => useAddModeStore.getState().reset(),
  },
  {
    sources: ["features/decks/stores/deck-builder-ui-store.ts"],
    storage: "memory",
    keys: [],
    phase: "before-leave",
    reset: () => useDeckBuilderUiStore.getState().reset(),
  },
  {
    sources: ["stores/onboarding-store.ts"],
    storage: "localStorage",
    keys: ["openrift-onboarding"],
    phase: "after-leave",
    reset: () => resetToInitial(useOnboardingStore),
  },
  {
    sources: ["stores/milestone-banner-store.ts"],
    storage: "localStorage",
    keys: ["openrift-milestone-banner"],
    phase: "after-leave",
    reset: () => resetToInitial(useMilestoneBannerStore),
  },
  {
    sources: ["stores/sidebar-fold-store.ts"],
    storage: "localStorage",
    keys: ["openrift-sidebar-fold"],
    phase: "after-leave",
    reset: () => useSidebarFoldStore.getState().reset(),
  },
  {
    sources: ["components/ui/sidebar.tsx"],
    storage: "cookie",
    keys: ["sidebar_state"],
    phase: "after-leave",
    reset: () => {
      void cookieStorage?.removeItem("sidebar_state");
    },
  },
  {
    sources: ["features/account/stores/locale-banner-store.ts"],
    storage: "localStorage",
    keys: ["openrift-locale-banner"],
    phase: "after-leave",
    reset: () => resetToInitial(useLocaleBannerStore),
  },
  {
    sources: ["features/admin/stores/admin-settings-store.ts"],
    storage: "localStorage",
    keys: ["admin-settings"],
    phase: "after-leave",
    reset: () => resetToInitial(useAdminSettingsStore),
  },
  {
    sources: ["features/admin/components/design/design-specs.tsx"],
    storage: "localStorage",
    keys: ["openrift.design.specs"],
    phase: "after-leave",
    reset: () => removeLocalItem("openrift.design.specs"),
  },
  {
    sources: ["features/catalog-workspace/stores/workspace-skip-store.ts"],
    storage: "localStorage",
    keys: ["catalog-workspace-skipped"],
    phase: "after-leave",
    reset: () => resetToInitial(useWorkspaceSkipStore),
  },
  {
    sources: ["features/scan/stores/scan-prefs-store.ts"],
    storage: "localStorage",
    keys: ["openrift-scan-prefs"],
    phase: "after-leave",
    reset: () => resetToInitial(useScanPrefsStore),
  },
  {
    sources: ["features/scan/stores/scan-session-store.ts"],
    storage: "localStorage",
    keys: ["openrift-scan-session"],
    phase: "after-leave",
    reset: () => useScanSessionStore.getState().reset(),
  },
  {
    sources: ["features/scan/lib/scan-journal.ts"],
    storage: "localStorage",
    keys: ["openrift-scan-journal"],
    phase: "after-leave",
    reset: clearScanJournal,
  },
  {
    sources: ["features/tournaments/stores/deck-check-view-store.ts"],
    storage: "localStorage",
    keys: ["deck-check-view"],
    phase: "after-leave",
    reset: () => resetToInitial(useDeckCheckViewStore),
  },
  {
    sources: ["features/decks/stores/deck-overview-view-store.ts"],
    storage: "localStorage",
    keys: ["deck-overview-view"],
    phase: "after-leave",
    reset: () => resetToInitial(useDeckOverviewViewStore),
  },
  {
    sources: ["features/decks/stores/deck-list-prefs-store.ts"],
    storage: "localStorage",
    keys: ["openrift-deck-list-prefs"],
    phase: "after-leave",
    reset: () => resetToInitial(useDeckListPrefsStore),
  },
  {
    sources: ["features/board-states/stores/board-draft-store.ts"],
    storage: "localStorage",
    keys: ["openrift-board-state-draft"],
    phase: "after-leave",
    reset: () => useBoardDraftStore.getState().clearDraft(),
  },
  {
    sources: ["features/groups/stores/buy-cart-store.ts"],
    storage: "localStorage",
    keys: ["openrift-buy-cart"],
    phase: "after-leave",
    reset: () => resetToInitial(useBuyCartStore),
  },
  {
    sources: ["features/groups/stores/trade-tally-store.ts"],
    storage: "localStorage",
    keys: ["openrift-trade-tally"],
    phase: "after-leave",
    reset: () => resetToInitial(useTradeTallyStore),
  },
  {
    sources: ["features/groups/stores/trade-add-target-store.ts"],
    storage: "localStorage",
    keys: ["openrift-trade-add-target"],
    phase: "after-leave",
    reset: () => resetToInitial(useTradeAddTargetStore),
  },
  {
    sources: ["features/groups/lib/trade-settlement-request.ts"],
    storage: "sessionStorage",
    keys: ["openrift-settlement:*"],
    phase: "after-leave",
    reset: clearTradeSettlementRequests,
  },
  {
    sources: ["features/match-tracker/stores/match-tracker-store.ts"],
    storage: "localStorage",
    keys: ["openrift-match-tracker"],
    phase: "after-leave",
    reset: () => resetToInitial(useMatchTrackerStore),
  },
  {
    // Entries for this device's signed-out decks stay with those decks.
    sources: ["features/decks/stores/deck-odds-groups-store.ts"],
    storage: "localStorage",
    keys: ["deck-odds-groups"],
    phase: "after-leave",
    reset: keepLocalDeckOddsGroups,
  },
  {
    sources: ["features/decks/lib/local-decks-collection.ts"],
    storage: "localStorage",
    keys: ["openrift-local-decks-v2", "openrift-local-decks", "openrift-local-decks-migrated"],
    keep: "Decks built signed out belong to this device, not to an account (ADR-035). Signing in offers to import them, and an import removes them here.",
  },
  {
    sources: ["hooks/use-browser-locale.ts", "features/account/hooks/use-preferences-sync.ts"],
    storage: "cookie",
    keys: ["PARAGLIDE_LOCALE"],
    keep: "The server renders the page language from this cookie. Clearing it would switch the language of the page shown right after signing out.",
  },
  {
    sources: ["stores/install-store.ts"],
    storage: "localStorage",
    keys: ["openrift-install"],
    keep: "Describes the app install on this device. Clearing it would show the installed toast again in the installed app after every sign-out.",
  },
  {
    sources: ["features/admin/components/site-settings-page.tsx"],
    storage: "localStorage",
    keys: ["umami.disabled"],
    keep: "Excludes this device from page analytics. Clearing it would silently start counting this device again.",
  },
  {
    sources: ["features/account/lib/referral-storage.ts"],
    storage: "localStorage",
    keys: ["openrift-pending-referral"],
    keep: "An invite code from a link opened on this device, credited to the next account created here. It is not the signed-out account's data and expires after 30 days.",
  },
  {
    sources: ["features/groups/lib/join-intent.ts"],
    storage: "sessionStorage",
    keys: ["openrift-join-intent:*"],
    keep: "Set by a click on a group invite page and used up by the sign-in that follows. It holds an invite code, no account data, and ends with the tab.",
  },
  {
    sources: ["features/admin/components/outline-label-page.tsx"],
    storage: "localStorage",
    keys: ["openrift-scan-labels:*"],
    keep: "Unsaved labelling work on local image folders, which exists nowhere else and holds no account data.",
  },
  {
    sources: ["lib/analytics.ts"],
    storage: "localStorage",
    keys: ["openrift:first-touch"],
    keep: "Anonymous referrer of this browser's first visit, which attributes the next sign-up.",
  },
  {
    sources: ["lib/analytics.ts"],
    storage: "sessionStorage",
    keys: ["openrift:signup-cta"],
    keep: "The sign-up button used in this tab, which attributes the next sign-up and holds no account data.",
  },
  {
    sources: ["lib/stale-bundle-reload.ts"],
    storage: "sessionStorage",
    keys: ["openrift:reload-attempted"],
    keep: "Guards against reload loops after a deploy and holds no account data.",
  },
];

/** A failing entry is reported and never stops the others. */
export async function resetClientState(phase: ResetPhase): Promise<void> {
  for (const entry of CLIENT_STATE) {
    if ("reset" in entry && entry.phase === phase) {
      try {
        await entry.reset();
      } catch (error) {
        captureHandledError(error, { clientStateReset: entry.sources.join(",") });
      }
    }
  }
}
