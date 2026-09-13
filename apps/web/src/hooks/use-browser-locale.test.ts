import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as Runtime from "@/paraglide/runtime.js";

import { useBrowserLocale } from "./use-browser-locale";

const runtime = vi.hoisted(() => ({
  preferred: undefined as string | undefined,
  writesCookie: true,
  setLocale: vi.fn(),
}));

vi.mock("@/paraglide/runtime.js", async (importOriginal) => {
  const original = await importOriginal<typeof Runtime>();
  return {
    ...original,
    getLocale: () => "en",
    extractLocaleFromNavigator: () => runtime.preferred,
    setLocale: runtime.setLocale,
  };
});

const reloadSpy = vi.fn();

function clearCookies() {
  for (const entry of document.cookie.split(";")) {
    const name = entry.split("=")[0]?.trim();
    if (name) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  }
}

beforeEach(() => {
  clearCookies();
  runtime.preferred = undefined;
  runtime.writesCookie = true;
  runtime.setLocale.mockReset();
  runtime.setLocale.mockImplementation((locale: string) => {
    if (runtime.writesCookie) {
      document.cookie = `PARAGLIDE_LOCALE=${locale}; path=/`;
    }
  });
  reloadSpy.mockReset();
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { ...globalThis.location, reload: reloadSpy },
  });
});

afterEach(() => {
  clearCookies();
});

describe("useBrowserLocale", () => {
  it("adopts a supported browser language on a first visit and reloads once", () => {
    runtime.preferred = "de";
    renderHook(() => useBrowserLocale());
    expect(runtime.setLocale).toHaveBeenCalledWith("de", { reload: false });
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("never overrides a saved choice", () => {
    document.cookie = "PARAGLIDE_LOCALE=en; path=/";
    runtime.preferred = "de";
    renderHook(() => useBrowserLocale());
    expect(runtime.setLocale).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("does nothing when the browser already matches the page or has no supported language", () => {
    runtime.preferred = "en";
    renderHook(() => useBrowserLocale());
    runtime.preferred = undefined;
    renderHook(() => useBrowserLocale());
    expect(runtime.setLocale).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("does not reload when the cookie could not be written", () => {
    runtime.preferred = "fr";
    runtime.writesCookie = false;
    renderHook(() => useBrowserLocale());
    expect(runtime.setLocale).toHaveBeenCalledWith("fr", { reload: false });
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
