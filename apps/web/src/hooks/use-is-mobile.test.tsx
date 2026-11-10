import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function renderIsMobile(matches: boolean) {
  const matchMedia = vi.fn(() => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal("matchMedia", matchMedia);
  const { useIsMobile } = await import("./use-is-mobile");
  const { result } = renderHook(() => useIsMobile());
  return { result, matchMedia };
}

describe("useIsMobile", () => {
  it("queries widths below 768px", async () => {
    const { matchMedia } = await renderIsMobile(true);
    expect(matchMedia).toHaveBeenCalledWith("(max-width: 767px)");
  });

  it("is true when the query matches", async () => {
    const { result } = await renderIsMobile(true);
    expect(result.current).toBe(true);
  });

  it("is false when the query does not match", async () => {
    const { result } = await renderIsMobile(false);
    expect(result.current).toBe(false);
  });
});
