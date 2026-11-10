import { readFileSync } from "node:fs";
import path from "node:path";

import type { UserPreferencesResponse } from "@openrift/shared/types/api/preferences";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface ServerFnCallOptions {
  data?: unknown;
  fetch?: typeof fetch;
}

const { serverFnCalls } = vi.hoisted(() => ({ serverFnCalls: [] as ServerFnCallOptions[] }));

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const chain = {
      handler:
        (fn: (args: { context: { cookie: string }; data: unknown }) => unknown) =>
        (args?: ServerFnCallOptions) => {
          serverFnCalls.push(args ?? {});
          return fn({ context: { cookie: "" }, data: args?.data });
        },
      middleware: () => chain,
      validator: () => chain,
    };
    return chain;
  },
}));

vi.mock("@/lib/server-fns/middleware", () => ({ withCookies: () => {} }));

// Mutable: lets a test drive sign-out/sign-in without remounting the hook.
const { signedInUser } = vi.hoisted(() => ({
  signedInUser: { id: "test-user-id" as string | null },
}));
vi.mock("@/hooks/use-session", () => ({ useUserId: () => signedInUser.id }));
vi.mock("@/hooks/use-hydrated", () => ({ useHydrated: () => true }));
vi.mock("@/paraglide/runtime.js", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  setLocale: vi.fn(),
}));

const { applyDisplayLocale, usePreferencesSync } = await import("./use-preferences-sync");
const { useLocaleBannerStore } = await import("@/features/account/stores/locale-banner-store");
const { useDisplayStore } = await import("@/stores/display-store");
const { useThemeStore } = await import("@/stores/theme-store");
const { preferencesKeys } = await import("@/features/account/lib/account-query-keys");
const { createStoreResetter } = await import("@/test/store-helpers");

const resetDisplay = createStoreResetter(useDisplayStore);
const resetTheme = createStoreResetter(useThemeStore);
const resetLocaleBanner = createStoreResetter(useLocaleBannerStore);

interface FetchCall {
  method: string;
  body: unknown;
}

// oRPC's OpenAPI link sends a body-bearing request as a `Request` object, so the
// method/body are read from whichever shape the call used.
function stubFetch(prefs: UserPreferencesResponse) {
  const calls: FetchCall[] = [];
  let current = prefs;
  const fetchMock = vi.fn(async (input: unknown, init?: { method?: string; body?: string }) => {
    let method = init?.method ?? "GET";
    let bodyText = init?.body;
    if (input instanceof Request) {
      method = input.method;
      bodyText = await input.clone().text();
    }
    calls.push({ method, body: bodyText ? JSON.parse(bodyText) : undefined });
    if (method === "GET") {
      return Response.json(current);
    }
    return new Response(null, { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return {
    calls,
    patches: () => calls.filter((call) => call.method !== "GET"),
    setServerPrefs: (next: UserPreferencesResponse) => {
      current = next;
    },
  };
}

function wrap() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, Wrapper };
}

// Real timers, not fake: waitFor does not drive vitest's fake clock.
const SAVE_DEBOUNCE_MS = 1000;

async function flushSaveDebounce() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, SAVE_DEBOUNCE_MS + 250);
    });
  });
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  serverFnCalls.length = 0;
  resetDisplay();
  resetTheme();
  resetLocaleBanner();
  signedInUser.id = "test-user-id";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("applyDisplayLocale", () => {
  it("dismisses the locale banner when a language is chosen", async () => {
    stubFetch({});
    await expect(applyDisplayLocale("de", { persist: true })).resolves.toBe(true);
    expect(useLocaleBannerStore.getState().dismissed).toBe(true);
  });

  it("keeps the locale banner when the account write fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    await expect(applyDisplayLocale("de", { persist: true })).resolves.toBe(false);
    expect(useLocaleBannerStore.getState().dismissed).toBe(false);
  });
});

describe("usePreferencesSync", () => {
  it("hydrates the stores from the first server payload", async () => {
    stubFetch({ showImages: false, theme: "dark" } as UserPreferencesResponse);
    const { Wrapper } = wrap();
    renderHook(() => usePreferencesSync(true), { wrapper: Wrapper });

    await waitFor(() => expect(useDisplayStore.getState().prefsHydrated).toBe(true));
    expect(useDisplayStore.getState().showImages).toBe(false);
    expect(useThemeStore.getState().preference).toBe("dark");
  });

  it("does not PATCH back the values it just hydrated", async () => {
    const { patches } = stubFetch({ showImages: false } as UserPreferencesResponse);
    const { Wrapper } = wrap();
    renderHook(() => usePreferencesSync(true), { wrapper: Wrapper });

    await waitFor(() => expect(useDisplayStore.getState().prefsHydrated).toBe(true));
    await flushSaveDebounce();

    expect(patches()).toHaveLength(0);
  });

  it("saves a preference the user changes", async () => {
    const { patches } = stubFetch({ showImages: true } as UserPreferencesResponse);
    const { Wrapper } = wrap();
    renderHook(() => usePreferencesSync(true), { wrapper: Wrapper });

    await waitFor(() => expect(useDisplayStore.getState().prefsHydrated).toBe(true));
    act(() => useDisplayStore.getState().setShowImages(false));
    await flushSaveDebounce();

    expect(patches()).toHaveLength(1);
    expect(patches()[0]?.body).toMatchObject({ showImages: false });
  });

  it("sends the retired completionScope as null so the account copy is cleared", async () => {
    const { patches } = stubFetch({ showImages: true } as UserPreferencesResponse);
    const { Wrapper } = wrap();
    renderHook(() => usePreferencesSync(true), { wrapper: Wrapper });

    await waitFor(() => expect(useDisplayStore.getState().prefsHydrated).toBe(true));
    act(() => useDisplayStore.getState().setShowImages(false));
    await flushSaveDebounce();

    expect(patches()[0]?.body).toMatchObject({ completionScope: null });
  });

  it("ignores device-local store changes that carry no preference", async () => {
    const { patches } = stubFetch({} as UserPreferencesResponse);
    const { Wrapper } = wrap();
    renderHook(() => usePreferencesSync(true), { wrapper: Wrapper });

    await waitFor(() => expect(useDisplayStore.getState().prefsHydrated).toBe(true));
    act(() => useDisplayStore.getState().setMaxColumns(4));
    act(() => useDisplayStore.getState().setFiltersExpanded(true));
    await flushSaveDebounce();

    expect(patches()).toHaveLength(0);
  });

  it("saves a change made in the same frame a server payload lands", async () => {
    const { patches } = stubFetch({ showImages: true } as UserPreferencesResponse);
    const { client, Wrapper } = wrap();
    renderHook(() => usePreferencesSync(true), { wrapper: Wrapper });

    await waitFor(() => expect(useDisplayStore.getState().prefsHydrated).toBe(true));

    act(() => {
      client.setQueryData(preferencesKeys.all("test-user-id"), {
        showImages: true,
        fancyFan: false,
      });
    });
    act(() => useDisplayStore.getState().setShowImages(false));
    await flushSaveDebounce();

    expect(patches()).toHaveLength(1);
    expect(patches()[0]?.body).toMatchObject({ showImages: false });
    expect(useDisplayStore.getState().showImages).toBe(false);
  });

  it("keeps a pending edit when a refetch resolves with the pre-edit value", async () => {
    const { patches, setServerPrefs } = stubFetch({ showImages: true } as UserPreferencesResponse);
    const { client, Wrapper } = wrap();
    renderHook(() => usePreferencesSync(true), { wrapper: Wrapper });

    await waitFor(() => expect(useDisplayStore.getState().prefsHydrated).toBe(true));
    act(() => useDisplayStore.getState().setShowImages(false));

    setServerPrefs({ showImages: true } as UserPreferencesResponse);
    act(() => {
      client.setQueryData(preferencesKeys.all("test-user-id"), { showImages: true });
    });
    await flushMicrotasks();

    expect(useDisplayStore.getState().showImages).toBe(false);

    await flushSaveDebounce();
    expect(patches().at(-1)?.body).toMatchObject({ showImages: false });
  });

  it("re-applies the server prefs after a sign-out / sign-in cycle", async () => {
    const { patches } = stubFetch({ languages: ["de"], theme: "dark" } as UserPreferencesResponse);
    const { Wrapper } = wrap();
    const { rerender } = renderHook(({ enabled }) => usePreferencesSync(enabled), {
      initialProps: { enabled: true },
      wrapper: Wrapper,
    });

    await waitFor(() => expect(useThemeStore.getState().preference).toBe("dark"));

    act(() => {
      useDisplayStore.getState().reset();
      useThemeStore.getState().reset();
    });
    signedInUser.id = null;
    rerender({ enabled: false });
    expect(useThemeStore.getState().preference).toBeNull();

    signedInUser.id = "test-user-id";
    rerender({ enabled: true });
    await flushMicrotasks();

    expect(useThemeStore.getState().preference).toBe("dark");
    expect(useDisplayStore.getState().overrides.languages).toEqual(["de"]);

    await flushSaveDebounce();
    expect(patches()).toHaveLength(0);
  });

  it("still releases the hydration signal when it stands down for a pending edit", async () => {
    stubFetch({ showImages: true } as UserPreferencesResponse);
    const { client, Wrapper } = wrap();
    renderHook(() => usePreferencesSync(false), { wrapper: Wrapper });

    act(() => useDisplayStore.getState().setShowImages(false));
    act(() => {
      client.setQueryData(preferencesKeys.all("test-user-id"), { showImages: true });
    });
    await flushMicrotasks();

    expect(useDisplayStore.getState().prefsHydrated).toBe(true);
  });

  it("marks prefs hydrated for logged-out visitors without fetching", async () => {
    const { calls } = stubFetch({} as UserPreferencesResponse);
    const { Wrapper } = wrap();
    renderHook(() => usePreferencesSync(false), { wrapper: Wrapper });

    await waitFor(() => expect(useDisplayStore.getState().prefsHydrated).toBe(true));
    expect(calls).toHaveLength(0);
  });

  it("keeps the stores diverged when the save fails, so the edit survives", async () => {
    const { patches } = stubFetch({ showImages: true } as UserPreferencesResponse);
    const { Wrapper } = wrap();
    renderHook(() => usePreferencesSync(true), { wrapper: Wrapper });

    await waitFor(() => expect(useDisplayStore.getState().prefsHydrated).toBe(true));

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    act(() => useDisplayStore.getState().setShowImages(false));
    await flushSaveDebounce();

    expect(useDisplayStore.getState().showImages).toBe(false);
    expect(patches()).toHaveLength(0);
  });

  it("sends a pending edit with keepalive as soon as the tab is hidden", async () => {
    const { patches } = stubFetch({ showImages: true } as UserPreferencesResponse);
    const { Wrapper } = wrap();
    renderHook(() => usePreferencesSync(true), { wrapper: Wrapper });
    await waitFor(() => expect(useDisplayStore.getState().prefsHydrated).toBe(true));

    act(() => useDisplayStore.getState().setShowImages(false));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    try {
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await waitFor(() => expect(patches()).toHaveLength(1), { timeout: 500 });
    } finally {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    }

    const keepaliveCall = serverFnCalls.at(-1);
    const sentInits: RequestInit[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: unknown, init: RequestInit) => {
        sentInits.push(init);
        return new Response(null, { status: 200 });
      }),
    );
    await keepaliveCall?.fetch?.("/_serverFn/prefs", { method: "POST" });
    expect(sentInits[0]).toMatchObject({ method: "POST", keepalive: true });
  });

  it("flushes a pending edit on pagehide without waiting for the debounce", async () => {
    const { patches } = stubFetch({ showImages: true } as UserPreferencesResponse);
    const { Wrapper } = wrap();
    renderHook(() => usePreferencesSync(true), { wrapper: Wrapper });
    await waitFor(() => expect(useDisplayStore.getState().prefsHydrated).toBe(true));

    act(() => useDisplayStore.getState().setShowImages(false));
    act(() => {
      globalThis.dispatchEvent(new Event("pagehide"));
    });

    await waitFor(() => expect(patches()).toHaveLength(1), { timeout: 500 });
    expect(patches()[0]?.body).toMatchObject({ showImages: false });
    await flushSaveDebounce();
    expect(patches()).toHaveLength(1);
  });

  it("retries a failed save once", { timeout: 10_000 }, async () => {
    stubFetch({ showImages: true } as UserPreferencesResponse);
    const { Wrapper } = wrap();
    renderHook(() => usePreferencesSync(true), { wrapper: Wrapper });
    await waitFor(() => expect(useDisplayStore.getState().prefsHydrated).toBe(true));

    const patchStatuses = [500, 200];
    const attempts: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const status = patchStatuses[attempts.length] ?? 200;
        attempts.push(status);
        return new Response(status === 200 ? null : "{}", { status });
      }),
    );
    act(() => useDisplayStore.getState().setShowImages(false));
    await flushSaveDebounce();
    expect(attempts).toEqual([500]);

    await waitFor(() => expect(attempts).toEqual([500, 200]), { timeout: 3000 });
  });

  it("gives up after one retry", { timeout: 10_000 }, async () => {
    stubFetch({ showImages: true } as UserPreferencesResponse);
    const { Wrapper } = wrap();
    renderHook(() => usePreferencesSync(true), { wrapper: Wrapper });
    await waitFor(() => expect(useDisplayStore.getState().prefsHydrated).toBe(true));

    const failing = vi.fn(async () => new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", failing);
    act(() => useDisplayStore.getState().setShowImages(false));
    await flushSaveDebounce();
    await waitFor(() => expect(failing).toHaveBeenCalledTimes(2), { timeout: 3000 });
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 2500);
      });
    });

    expect(failing).toHaveBeenCalledTimes(2);
  });

  // React Compiler cannot lower `??=` and bails out of the whole hook; this
  // source-level check catches it in vitest, where the compiler doesn't run.
  it("does not use `??=` assignments (React Compiler cannot lower them)", () => {
    const source = readFileSync(path.resolve(__dirname, "./use-preferences-sync.ts"), "utf-8");
    expect(source).not.toMatch(/[\w)\]]\s*\?\?=/u);
  });
});
