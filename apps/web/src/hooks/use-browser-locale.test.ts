import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as Runtime from "@/paraglide/runtime.js";

import { useBrowserLocale } from "./use-browser-locale";

const runtime = vi.hoisted(() => ({
  languages: [] as string[],
  writesCookie: true,
  setLocale: vi.fn(),
}));

vi.mock("@/paraglide/runtime.js", async (importOriginal) => {
  const original = await importOriginal<typeof Runtime>();
  return {
    ...original,
    getLocale: () => "en",
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
  runtime.languages = [];
  Object.defineProperty(navigator, "languages", {
    configurable: true,
    get: () => runtime.languages,
  });
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
    runtime.languages = ["de-DE", "en"];
    renderHook(() => useBrowserLocale());
    expect(runtime.setLocale).toHaveBeenCalledWith("de", { reload: false });
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("maps Chinese browser tags by region and script", () => {
    runtime.languages = ["zh-TW", "en"];
    renderHook(() => useBrowserLocale());
    expect(runtime.setLocale).toHaveBeenCalledWith("zh-Hant", { reload: false });
    runtime.setLocale.mockClear();
    runtime.languages = ["zh-CN"];
    clearCookies();
    renderHook(() => useBrowserLocale());
    expect(runtime.setLocale).toHaveBeenCalledWith("zh-Hans", { reload: false });
  });

  it("never overrides a saved choice", () => {
    document.cookie = "PARAGLIDE_LOCALE=en; path=/";
    runtime.languages = ["de-DE", "en"];
    renderHook(() => useBrowserLocale());
    expect(runtime.setLocale).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("does nothing when the browser already matches the page or has no supported language", () => {
    runtime.languages = ["en-US"];
    renderHook(() => useBrowserLocale());
    runtime.languages = [];
    Object.defineProperty(navigator, "languages", {
      configurable: true,
      get: () => runtime.languages,
    });
    renderHook(() => useBrowserLocale());
    expect(runtime.setLocale).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("does not reload when the cookie could not be written", () => {
    runtime.languages = ["fr-FR"];
    runtime.writesCookie = false;
    renderHook(() => useBrowserLocale());
    expect(runtime.setLocale).toHaveBeenCalledWith("fr", { reload: false });
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
