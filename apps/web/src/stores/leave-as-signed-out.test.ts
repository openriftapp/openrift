import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { refreshViewerAfterSignOut } from "@/lib/viewer-change";

import { leaveAsSignedOut } from "./leave-as-signed-out";

vi.mock("@/lib/viewer-change", () => ({
  refreshViewerAfterSignOut: vi.fn(async (_client: unknown, leave: () => Promise<unknown>) => {
    await leave();
  }),
}));

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
