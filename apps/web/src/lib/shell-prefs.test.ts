// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  readClientCookie,
  resolvePaletteFromCookie,
  resolveThemeFromCookie,
  SHELL_PREFS_SCRIPT,
} from "./shell-prefs";

function clearCookies() {
  for (const row of document.cookie.split("; ")) {
    const name = row.split("=")[0];
    if (name) {
      document.cookie = `${name}=; path=/; max-age=0`;
    }
  }
}

describe("resolveThemeFromCookie", () => {
  it("resolves a dark preference to dark", () => {
    expect(resolveThemeFromCookie(JSON.stringify({ state: { preference: "dark" } }))).toBe("dark");
  });

  it("resolves a light preference to light", () => {
    expect(resolveThemeFromCookie(JSON.stringify({ state: { preference: "light" } }))).toBe(
      "light",
    );
  });

  it("resolves auto to light without a system preference", () => {
    expect(resolveThemeFromCookie(JSON.stringify({ state: { preference: "auto" } }))).toBe("light");
  });

  it("resolves auto to dark when the system prefers dark", () => {
    expect(resolveThemeFromCookie(JSON.stringify({ state: { preference: "auto" } }), true)).toBe(
      "dark",
    );
  });

  it("defaults to dark when the cookie is missing", () => {
    expect(resolveThemeFromCookie(null)).toBe("dark");
    expect(resolveThemeFromCookie(undefined)).toBe("dark");
    expect(resolveThemeFromCookie("")).toBe("dark");
  });

  it("defaults to dark on malformed JSON", () => {
    expect(resolveThemeFromCookie("{not json")).toBe("dark");
  });

  it("defaults to dark when the envelope has no preference", () => {
    expect(resolveThemeFromCookie(JSON.stringify({ state: {} }))).toBe("dark");
    expect(resolveThemeFromCookie(JSON.stringify({}))).toBe("dark");
  });
});

describe("resolvePaletteFromCookie", () => {
  it("returns a known palette", () => {
    expect(resolvePaletteFromCookie(JSON.stringify({ state: { preference: "default" } }))).toBe(
      "default",
    );
  });

  it("clamps unknown palettes to default", () => {
    expect(
      resolvePaletteFromCookie(JSON.stringify({ state: { preference: "not-a-palette" } })),
    ).toBe("default");
  });

  it("clamps non-string preferences to default", () => {
    expect(resolvePaletteFromCookie(JSON.stringify({ state: { preference: 42 } }))).toBe("default");
  });

  it("defaults when the cookie is missing or malformed", () => {
    expect(resolvePaletteFromCookie(null)).toBe("default");
    expect(resolvePaletteFromCookie(undefined)).toBe("default");
    expect(resolvePaletteFromCookie("{not json")).toBe("default");
  });
});

describe("readClientCookie", () => {
  beforeEach(() => {
    clearCookies();
  });

  it("reads a cookie set in the same format cookie-storage writes", () => {
    const value = JSON.stringify({ state: { preference: "dark" } });
    document.cookie = `theme=${encodeURIComponent(value)}; path=/`;
    expect(readClientCookie("theme")).toBe(value);
  });

  it("returns null for a missing cookie", () => {
    expect(readClientCookie("theme")).toBeNull();
  });

  it("does not match cookies whose name only shares a prefix", () => {
    document.cookie = `theme-extra=${encodeURIComponent("x")}; path=/`;
    expect(readClientCookie("theme")).toBeNull();
  });

  it("preserves '=' characters inside the value", () => {
    document.cookie = `token=${encodeURIComponent("a=b=c")}; path=/`;
    expect(readClientCookie("token")).toBe("a=b=c");
  });

  it("round-trips with the theme resolver", () => {
    const value = JSON.stringify({ state: { preference: "dark" } });
    document.cookie = `theme=${encodeURIComponent(value)}; path=/`;
    expect(resolveThemeFromCookie(readClientCookie("theme"))).toBe("dark");
  });
});

describe("SHELL_PREFS_SCRIPT", () => {
  function setPref(name: string, preference: unknown) {
    document.cookie = `${name}=${encodeURIComponent(JSON.stringify({ state: { preference } }))}; path=/`;
  }

  function run(systemDark = false) {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: systemDark, media: query }));
    // oxlint-disable-next-line no-new-func, typescript/no-implied-eval -- runs the inline script as the browser would
    new Function(SHELL_PREFS_SCRIPT)();
    const root = document.documentElement;
    return { dark: root.classList.contains("dark"), palette: root.dataset.palette };
  }

  beforeEach(() => {
    clearCookies();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.className = "";
    delete document.documentElement.dataset.palette;
  });

  it("removes dark from a dark default shell for a light visitor", () => {
    document.documentElement.className = "dark";
    setPref("theme", "light");
    expect(run().dark).toBe(false);
  });

  it("adds dark to a light shell for a dark visitor", () => {
    setPref("theme", "dark");
    expect(run().dark).toBe(true);
  });

  it("follows the system for auto", () => {
    setPref("theme", "auto");
    expect(run(true).dark).toBe(true);
    document.documentElement.className = "dark";
    expect(run(false).dark).toBe(false);
  });

  it("falls back to dark without a cookie, on unknown values and on malformed cookies", () => {
    expect(run().dark).toBe(true);
    setPref("theme", "sepia");
    expect(run().dark).toBe(true);
    document.cookie = "theme=%7Bnot-json; path=/";
    expect(run().dark).toBe(true);
  });

  it("replaces the default shell's palette with the visitor's", () => {
    document.documentElement.dataset.palette = "default";
    setPref("palette", "minimal");
    expect(run().palette).toBe("minimal");
  });

  it("resets the palette to default without a cookie or for unknown values", () => {
    document.documentElement.dataset.palette = "minimal";
    expect(run().palette).toBe("default");
    document.documentElement.dataset.palette = "minimal";
    setPref("palette", "<script>");
    expect(run().palette).toBe("default");
  });

  it("applies the palette even when the theme cookie is malformed", () => {
    document.cookie = "theme=%7Bnot-json; path=/";
    setPref("palette", "minimal");
    expect(run().palette).toBe("minimal");
  });

  it("agrees with the server resolvers for every cookie value", () => {
    for (const theme of ["dark", "light", "auto", null, 7]) {
      for (const systemDark of [false, true]) {
        clearCookies();
        setPref("theme", theme);
        const expected = resolveThemeFromCookie(readClientCookie("theme"), systemDark);
        expect(run(systemDark).dark).toBe(expected === "dark");
      }
    }
    for (const palette of ["default", "minimal", "unknown", null]) {
      clearCookies();
      setPref("palette", palette);
      expect(run().palette).toBe(resolvePaletteFromCookie(readClientCookie("palette")));
    }
  });
});
