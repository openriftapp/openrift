import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useProgressiveCardImage } from "./use-progressive-card-image";

describe("useProgressiveCardImage", () => {
  it("starts on the thumbnail with nothing loaded or failed", () => {
    const { result } = renderHook(() => useProgressiveCardImage("thumb-a", "full-a"));
    expect(result.current.thumbnailFailed).toBe(false);
    expect(result.current.fullLoaded).toBe(false);
  });

  it("reports the full image once it loads, and resets for a new card", () => {
    const { result, rerender } = renderHook(
      ({ thumb, full }: { thumb: string; full: string }) => useProgressiveCardImage(thumb, full),
      { initialProps: { thumb: "thumb-a", full: "full-a" } },
    );
    act(() => result.current.onFullLoad());
    expect(result.current.fullLoaded).toBe(true);
    rerender({ thumb: "thumb-b", full: "full-b" });
    expect(result.current.fullLoaded).toBe(false);
  });

  it("marks only the thumbnail that failed", () => {
    const { result, rerender } = renderHook(
      ({ thumb }: { thumb: string }) => useProgressiveCardImage(thumb, null),
      { initialProps: { thumb: "thumb-a" } },
    );
    act(() => result.current.onThumbnailError());
    expect(result.current.thumbnailFailed).toBe(true);
    rerender({ thumb: "thumb-b" });
    expect(result.current.thumbnailFailed).toBe(false);
  });

  it("never reports a missing full image as loaded", () => {
    const { result } = renderHook(() => useProgressiveCardImage(null, null));
    act(() => result.current.onFullLoad());
    expect(result.current.fullLoaded).toBe(false);
    expect(result.current.thumbnailFailed).toBe(false);
  });
});
