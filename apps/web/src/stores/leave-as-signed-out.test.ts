// @vitest-environment jsdom
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { refreshViewerAfterSignOut } from "@/lib/viewer-change";

import {
  claimClientState,
  CLIENT_STATE_OWNER_KEY,
  leaveAsSignedOut,
  ownsClientState,
} from "./leave-as-signed-out";

vi.mock("@/lib/viewer-change", () => ({
  refreshViewer: vi.fn(),
  refreshViewerAfterSignOut: vi.fn(async (_client: unknown, leave: () => Promise<unknown>) => {
    await leave();
  }),
}));

vi.mock("@/stores/client-state-reset", () => {
  throw new Error("chunk failed to load");
});

beforeEach(() => {
  vi.mocked(refreshViewerAfterSignOut).mockClear();
});

describe("leaveAsSignedOut", () => {
  it("resets the shell state before leaving and the rest afterwards", async () => {
    const calls: string[] = [];
    const reset = async (phase: string) => {
      calls.push(`reset ${phase}`);
    };

    await leaveAsSignedOut(
      new QueryClient(),
      async () => {
        calls.push("leave");
      },
      Promise.resolve(reset),
    );

    expect(calls).toEqual(["reset before-leave", "leave", "reset after-leave"]);
  });

  it("still leaves when the reset chunk failed to load", async () => {
    const leave = vi.fn(async () => {});

    await leaveAsSignedOut(new QueryClient(), leave, Promise.resolve(null));

    expect(leave).toHaveBeenCalledOnce();
    expect(refreshViewerAfterSignOut).toHaveBeenCalledOnce();
  });
});

describe("claimClientState", () => {
  it("keeps the previous owner when the reset chunk failed to load, so the next load retries", async () => {
    localStorage.setItem(CLIENT_STATE_OWNER_KEY, "user-a");

    await claimClientState("user-b");

    expect(localStorage.getItem(CLIENT_STATE_OWNER_KEY)).toBe("user-a");
    expect(ownsClientState("user-b")).toBe(false);
    localStorage.removeItem(CLIENT_STATE_OWNER_KEY);
  });

  it("claims a device no account owns even when the reset chunk failed to load", async () => {
    await claimClientState("user-b");
    expect(localStorage.getItem(CLIENT_STATE_OWNER_KEY)).toBe("user-b");
    localStorage.removeItem(CLIENT_STATE_OWNER_KEY);
  });

  it("leaves a device its own account already owns untouched", () => {
    localStorage.setItem(CLIENT_STATE_OWNER_KEY, "user-b");
    expect(claimClientState("user-b")).toBeNull();
    localStorage.removeItem(CLIENT_STATE_OWNER_KEY);
  });
});
