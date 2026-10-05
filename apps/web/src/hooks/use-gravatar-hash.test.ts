// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useGravatarHash } from "./use-gravatar-hash";

describe("useGravatarHash", () => {
  it("resolves to the sha256 hex digest of the trimmed, lowercased email", async () => {
    const { result } = renderHook(() => useGravatarHash("  Test@Example.com  "));

    expect(result.current).toBeUndefined();

    await waitFor(() => {
      expect(result.current).toBe(
        "973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b",
      );
    });
  });

  it("returns undefined when email is undefined", () => {
    const { result } = renderHook(() => useGravatarHash(undefined));

    expect(result.current).toBeUndefined();
  });

  it("recomputes the hash when the email changes", async () => {
    const { result, rerender } = renderHook(({ email }) => useGravatarHash(email), {
      initialProps: { email: "a@example.com" },
    });

    await waitFor(() => expect(result.current).toBeDefined());
    const first = result.current;

    rerender({ email: "b@example.com" });

    await waitFor(() => expect(result.current).not.toBe(first));
  });

  it("does not update state after unmount", async () => {
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => errors.push(args));
    const { unmount } = renderHook(() => useGravatarHash("a@example.com"));

    unmount();
    // oxlint-disable-next-line promise/avoid-new -- wrapping the setTimeout callback API to await a delay
    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });

    expect(errors).toHaveLength(0);
    spy.mockRestore();
  });
});
