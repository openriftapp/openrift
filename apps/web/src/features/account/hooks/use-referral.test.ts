// @vitest-environment happy-dom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pendingReferral, rememberReferral } from "@/features/account/lib/referral-storage";

const serverFn = vi.fn<(input: { data: { code: string } }) => Promise<unknown>>();

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const chain = {
      validator: () => chain,
      middleware: () => chain,
      handler: () => serverFn,
    };
    return chain;
  },
}));

const { useReferralCapture } = await import("./use-referral");

const CODE = "AbC123xyz789";

beforeEach(() => {
  serverFn.mockResolvedValue({ claimed: true });
  globalThis.history.replaceState(null, "", "/decks/share/tok");
});

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("useReferralCapture", () => {
  it("stores a code from the hash and strips it from the address bar", () => {
    globalThis.history.replaceState(null, "", `/decks/share/tok?view=grid#r=${CODE}`);
    renderHook(() => useReferralCapture(null));

    expect(pendingReferral()).toBe(CODE);
    expect(`${globalThis.location.pathname}${globalThis.location.search}`).toBe(
      "/decks/share/tok?view=grid",
    );
    expect(globalThis.location.hash).toBe("");
    expect(serverFn).not.toHaveBeenCalled();
  });

  it("leaves an unrelated hash alone", () => {
    globalThis.history.replaceState(null, "", "/rules#section-4");
    renderHook(() => useReferralCapture(null));

    expect(pendingReferral()).toBeNull();
    expect(globalThis.location.hash).toBe("#section-4");
  });

  it("claims a stored code once signed in and forgets it", async () => {
    rememberReferral(CODE);
    renderHook(() => useReferralCapture("user-1"));

    expect(serverFn).toHaveBeenCalledExactlyOnceWith({ data: { code: CODE } });
    await waitFor(() => expect(pendingReferral()).toBeNull());
  });

  it("keeps the code when the claim request fails", async () => {
    serverFn.mockRejectedValue(new Error("offline"));
    rememberReferral(CODE);
    renderHook(() => useReferralCapture("user-1"));

    await waitFor(() => expect(serverFn).toHaveBeenCalled());
    expect(pendingReferral()).toBe(CODE);
  });

  it("does nothing while signed out", () => {
    rememberReferral(CODE);
    renderHook(() => useReferralCapture(null));

    expect(serverFn).not.toHaveBeenCalled();
    expect(pendingReferral()).toBe(CODE);
  });
});
