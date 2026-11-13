// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useShareImagePreview } from "./use-share-image-preview";

const URL_A = "https://example.test/api/v1/decks/d1/image.png";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useShareImagePreview", () => {
  it("points the image at the render route and stops loading once it arrives", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useShareImagePreview(URL_A));
    expect(result.current.src).toBe(URL_A);
    expect(result.current.loading).toBe(true);
    act(() => result.current.onLoad());
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says to wait when the failed render was rate-limited, asking the route once", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useShareImagePreview(URL_A));
    act(() => result.current.onError());
    await waitFor(() =>
      expect(result.current.error).toBe(
        "Too many images in a short time. Wait a moment, then try again.",
      ),
    );
    expect(result.current.loading).toBe(false);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(URL_A);
  });

  it("gives the general message for any other failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ status: 500 })),
    );
    const { result } = renderHook(() => useShareImagePreview(URL_A));
    act(() => result.current.onError());
    await waitFor(() =>
      expect(result.current.error).toBe("Couldn't prepare the image. Please try again."),
    );
  });

  it("asks again only when the viewer retries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ status: 429 })),
    );
    const { result } = renderHook(() => useShareImagePreview(URL_A));
    const firstKey = result.current.key;
    act(() => result.current.onError());
    await waitFor(() => expect(result.current.error).toBeDefined());
    act(() => result.current.retry());
    expect(result.current.key).not.toBe(firstKey);
    expect(result.current.error).toBeUndefined();
    expect(result.current.loading).toBe(true);
  });
});
