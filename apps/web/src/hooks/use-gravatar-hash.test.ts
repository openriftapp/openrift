// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type * as GravatarModule from "@/lib/gravatar";

import { useGravatarHash } from "./use-gravatar-hash";

const digestOverride = vi.hoisted(() => ({
  current: undefined as ((input: string) => Promise<string>) | undefined,
}));

vi.mock("@/lib/gravatar", async (importOriginal) => {
  const actual = await importOriginal<typeof GravatarModule>();
  return {
    ...actual,
    sha256Hex: (input: string) => digestOverride.current?.(input) ?? actual.sha256Hex(input),
  };
});

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

  it("drops a digest that lands after the email changed", async () => {
    let resolveStale = (_hash: string) => {};
    const stale = new Promise<string>((resolve) => {
      resolveStale = resolve;
    });
    digestOverride.current = (input) =>
      input === "a@example.com" ? stale : Promise.resolve(`hash-of-${input}`);
    try {
      const { result, rerender } = renderHook(({ email }) => useGravatarHash(email), {
        initialProps: { email: "a@example.com" },
      });
      rerender({ email: "b@example.com" });
      await waitFor(() => expect(result.current).toBe("hash-of-b@example.com"));

      await act(async () => {
        resolveStale("hash-of-a@example.com");
        // Same chain shape as the hook's `await sha256Hex(...).catch(...)`, registered
        // later, so the hook's continuation has run when this one does.
        await stale.catch(() => null);
      });

      expect(result.current).toBe("hash-of-b@example.com");
    } finally {
      digestOverride.current = undefined;
    }
  });
});
