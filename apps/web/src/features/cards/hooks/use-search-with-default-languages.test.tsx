import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockUseDisplayLanguages } = vi.hoisted(() => ({
  mockUseDisplayLanguages: vi.fn<() => readonly string[]>(),
}));

vi.mock("@/hooks/use-display-languages", () => ({
  useDisplayLanguages: mockUseDisplayLanguages,
}));

import { useSearchWithDefaultLanguages } from "./use-search-with-default-languages";

interface Search {
  q?: string;
  languages?: string[];
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("useSearchWithDefaultLanguages", () => {
  it("fills in the display languages while the URL names none", () => {
    mockUseDisplayLanguages.mockReturnValue(["EN"]);
    const { result } = renderHook(() => useSearchWithDefaultLanguages<Search>({ q: "jinx" }));
    expect(result.current).toEqual({ q: "jinx", languages: ["EN"] });
  });

  it("returns the search untouched when the URL names languages", () => {
    mockUseDisplayLanguages.mockReturnValue(["EN"]);
    const search: Search = { languages: ["ZH"] };
    const { result } = renderHook(() => useSearchWithDefaultLanguages(search));
    expect(result.current).toBe(search);
  });

  it("returns the search untouched when the viewer shows every language", () => {
    mockUseDisplayLanguages.mockReturnValue([]);
    const search: Search = {};
    const { result } = renderHook(() => useSearchWithDefaultLanguages(search));
    expect(result.current).toBe(search);
  });

  it("keeps languages empty after the visitor removes them from the URL", () => {
    mockUseDisplayLanguages.mockReturnValue(["EN"]);
    const { result, rerender } = renderHook(
      ({ search }: { search: Search }) => useSearchWithDefaultLanguages(search),
      { initialProps: { search: {} } },
    );
    expect(result.current.languages).toEqual(["EN"]);

    rerender({ search: { languages: ["EN"] } });
    expect(result.current.languages).toEqual(["EN"]);

    rerender({ search: {} });
    expect(result.current.languages).toBeUndefined();
  });

  it("follows the display languages until the URL names some", () => {
    mockUseDisplayLanguages.mockReturnValue(["EN"]);
    const { result, rerender } = renderHook(() => useSearchWithDefaultLanguages<Search>({}));
    mockUseDisplayLanguages.mockReturnValue(["EN", "ZH"]);
    rerender();
    expect(result.current.languages).toEqual(["EN", "ZH"]);
  });
});
