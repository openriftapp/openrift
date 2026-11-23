import { preferencesContract } from "@openrift/shared/contracts/preferences";
import type {
  DisplayLocale,
  UserPreferencesResponse,
} from "@openrift/shared/types/api/preferences";
import { useDebouncer } from "@tanstack/react-pacer";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";

import { preferencesKeys } from "@/features/account/lib/account-query-keys";
import { preferencesQueryOptions } from "@/features/account/lib/preferences-queries";
import type { PreferencesUpdateInput } from "@/features/account/lib/preferences-update";
import { mergeSavedPreferences } from "@/features/account/lib/preferences-update";
import { useLocaleBannerStore } from "@/features/account/stores/locale-banner-store";
import { usePaletteStore } from "@/features/collections/stores/palette-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { useScopeEffect } from "@/hooks/use-scope-effect";
import { useUserId } from "@/hooks/use-session";
import {
  claimDisplayLanguagesCookie,
  writeDisplayLanguagesCookie,
} from "@/lib/display-languages-cookie";
import { isDisplayLocale } from "@/lib/display-locale";
import { sanitizePalette, sanitizeServerResponse, sanitizeTheme } from "@/lib/sanitize-preferences";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";
import { serverFnFetch } from "@/lib/server-fns/server-fn-fetch";
import { getLocale, setLocale } from "@/paraglide/runtime.js";
import { useDisplayStore } from "@/stores/display-store";
import {
  claimClientState,
  isClientStateOwner,
  ownsClientState,
} from "@/stores/leave-as-signed-out";
import { useThemeStore } from "@/stores/theme-store";

const patchPreferencesFn = createServerFn({ method: "POST" })
  .validator((input: { prefs: PreferencesUpdateInput }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(preferencesContract, context.cookie).update(data.prefs);
  });

/**
 * Written on its own rather than through the debounced snapshot below: applying
 * a locale is a document reload, so the account must already agree before the
 * page comes back and re-reads it.
 */
async function persistDisplayLocale(locale: DisplayLocale): Promise<void> {
  await patchPreferencesFn({
    data: { prefs: { displayLocale: locale } },
  });
}

/** Resolves false when the account write failed and nothing changed. */
export async function applyDisplayLocale(
  locale: DisplayLocale,
  { persist }: { persist: boolean },
): Promise<boolean> {
  if (locale === getLocale()) {
    return true;
  }
  if (persist) {
    try {
      await persistDisplayLocale(locale);
    } catch {
      return false;
    }
  }
  useLocaleBannerStore.getState().dismiss();
  await setLocale(locale);
  return true;
}

function getPrefsSnapshot(): PreferencesUpdateInput {
  const { overrides } = useDisplayStore.getState();
  const { preference: themePreference } = useThemeStore.getState();
  const { preference: palettePreference } = usePaletteStore.getState();

  return {
    showImages: overrides.showImages,
    fancyFan: overrides.fancyFan,
    foilEffect: overrides.foilEffect,
    marketplaceOrder: overrides.marketplaceOrder,
    languages: overrides.languages,
    defaultCardView: overrides.defaultCardView,
    defaultCurrency: overrides.defaultCurrency,
    topLevelFilters: overrides.topLevelFilters,
    countExcludedCollections: overrides.countExcludedCollections,
    theme: themePreference,
    palette: palettePreference,
  };
}

const SAVE_RETRY_MS = 2000;

/** A `fetch` that the browser finishes sending after the page is closed. */
function keepaliveFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return serverFnFetch(input, { ...init, keepalive: true });
}

/**
 * getPrefsSnapshot builds its object literal in a fixed key order, so
 * stringify is stable and can be compared for equality.
 */
function serializePrefs(): string {
  return JSON.stringify(getPrefsSnapshot());
}

function writeLoadedLanguages(userId: string | null): void {
  if (userId) {
    writeDisplayLanguagesCookie(userId, useDisplayStore.getState().languages);
  }
}

/** Resolves false when the save failed, leaving `lastSynced` on the last confirmed value. */
async function pushPrefs(
  queryClient: QueryClient,
  userId: string,
  lastSynced: RefObject<string | null>,
  keepalive: boolean,
): Promise<boolean> {
  const snapshot = serializePrefs();
  if (snapshot === lastSynced.current || !ownsClientState(userId)) {
    return true;
  }
  const prefs = getPrefsSnapshot();
  try {
    await patchPreferencesFn({
      data: { prefs },
      ...(keepalive ? { fetch: keepaliveFetch } : {}),
    });
  } catch {
    return false;
  }
  lastSynced.current = snapshot;
  queryClient.setQueryData(
    preferencesKeys.all(userId),
    (previous: UserPreferencesResponse | undefined) => mergeSavedPreferences(previous, prefs),
  );
  return true;
}

export function usePreferencesSync(enabled: boolean) {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const hydrated = useHydrated();
  // Last snapshot known to match the server. Save skips when the stores
  // already match it; hydrate stands down when they don't. Null until seeded below.
  const lastSynced = useRef<string | null>(null);
  const [claimedFor, setClaimedFor] = useState<string | null>(null);
  const ownsState = userId === null || claimedFor === userId || isClientStateOwner(userId);

  const { data, isError } = useQuery({
    ...preferencesQueryOptions(userId),
    enabled: enabled && Boolean(userId) && hydrated && ownsState,
  });

  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The account whose preferences reached the store; the languages cookie follows only those.
  const languagesLoadedFor = useRef<string | null>(null);
  const languages = useDisplayStore((state) => state.languages);
  useEffect(() => {
    if (enabled && userId && languagesLoadedFor.current === userId) {
      writeDisplayLanguagesCookie(userId, languages);
    }
  }, [enabled, userId, languages]);

  async function save(keepalive: boolean) {
    if (!userId) {
      return;
    }
    const saved = await pushPrefs(queryClient, userId, lastSynced, keepalive);
    if (!saved && !keepalive) {
      retryTimer.current = setTimeout(() => {
        void pushPrefs(queryClient, userId, lastSynced, false);
      }, SAVE_RETRY_MS);
    }
  }

  const { maybeExecute: debouncedSave, cancel: cancelDebouncedSave } = useDebouncer(
    () => void save(false),
    { wait: 1000 },
  );

  useEffect(() => {
    function flush() {
      cancelDebouncedSave();
      void save(true);
    }
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        flush();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    globalThis.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      globalThis.removeEventListener("pagehide", flush);
    };
  });

  useEffect(
    () => () => {
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
      }
    },
    [],
  );

  // Logged-out, or a fetch error: mark hydrated so downstream consumers
  // (e.g. the language-seed hook) aren't blocked forever.
  useEffect(() => {
    if (!enabled || isError) {
      useDisplayStore.getState().markPrefsHydrated();
    }
  }, [enabled, isError]);

  // Must run before the hydrate effect below (effect order): re-baselines on
  // identity change so a sign-out reset isn't read as the next user's unsynced edit.
  useScopeEffect(userId, () => {
    cancelDebouncedSave();
    lastSynced.current = serializePrefs();
    languagesLoadedFor.current = null;
    claimDisplayLanguagesCookie(userId);
    const switching = userId ? claimClientState(userId) : null;
    if (!switching) {
      return;
    }
    let live = true;
    const settle = async () => {
      await switching;
      if (live) {
        cancelDebouncedSave();
        lastSynced.current = serializePrefs();
        setClaimedFor(userId);
      }
    };
    void settle();
    return () => {
      live = false;
    };
  });

  useEffect(() => {
    if (!data || !ownsState) {
      return;
    }

    // An unsynced local edit outranks this payload, which was in flight before
    // the edit happened; skip it but still release the hydration signal.
    if (userId) {
      languagesLoadedFor.current = userId;
    }
    if (lastSynced.current !== null && serializePrefs() !== lastSynced.current) {
      useDisplayStore.getState().markPrefsHydrated();
      writeLoadedLanguages(userId);
      return;
    }

    const overrides = sanitizeServerResponse(data);
    useDisplayStore.getState().hydrateOverrides(overrides);
    writeLoadedLanguages(userId);

    const theme = sanitizeTheme(data.theme);
    useThemeStore.getState().setTheme(theme);

    const palette = sanitizePalette(data.palette);
    usePaletteStore.getState().setPalette(palette);

    // Seeds the locale cookie on a device that has never carried it. setLocale
    // reloads the document, and after that the cookie agrees, so this is at
    // most one reload per new device.
    const storedLocale = data.displayLocale;
    if (isDisplayLocale(storedLocale) && storedLocale !== getLocale()) {
      void setLocale(storedLocale);
      return;
    }

    // Recomputed from the stores, not `data`: hydrateOverrides merges, so a key
    // the server omitted keeps its local value.
    lastSynced.current = serializePrefs();
  }, [data, userId, ownsState]);

  useEffect(() => {
    function onStoreChange() {
      if (serializePrefs() === lastSynced.current) {
        return;
      }
      debouncedSave();
    }

    const unsubDisplay = useDisplayStore.subscribe(onStoreChange);
    const unsubTheme = useThemeStore.subscribe(onStoreChange);
    const unsubPalette = usePaletteStore.subscribe(onStoreChange);

    return () => {
      unsubDisplay();
      unsubTheme();
      unsubPalette();
    };
  }, [debouncedSave]);
}
