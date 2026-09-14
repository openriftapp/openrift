import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface BlockerOptions {
  shouldBlockFn: () => boolean;
  enableBeforeUnload: () => boolean;
  withResolver: boolean;
}

const blocker = vi.hoisted(() => ({
  options: null as BlockerOptions | null,
  status: "idle" as "idle" | "blocked",
  proceed: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useBlocker: (options: BlockerOptions) => {
    blocker.options = options;
    return blocker.status === "blocked"
      ? { status: "blocked", proceed: blocker.proceed, reset: blocker.reset }
      : { status: "idle" };
  },
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { UnsavedChangesGuard } from "./unsaved-changes-guard";

beforeEach(() => {
  blocker.options = null;
  blocker.status = "idle";
  blocker.proceed.mockClear();
  blocker.reset.mockClear();
});

describe("UnsavedChangesGuard", () => {
  it("blocks navigation and the unload prompt only while dirty", () => {
    const { rerender } = render(<UnsavedChangesGuard dirty={false} />);
    expect(blocker.options?.shouldBlockFn()).toBe(false);
    expect(blocker.options?.enableBeforeUnload()).toBe(false);
    expect(blocker.options?.withResolver).toBe(true);

    rerender(<UnsavedChangesGuard dirty />);
    expect(blocker.options?.shouldBlockFn()).toBe(true);
    expect(blocker.options?.enableBeforeUnload()).toBe(true);
  });

  it("stays hidden while nothing is blocked", () => {
    render(<UnsavedChangesGuard dirty />);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("lets the navigation through on Leave", async () => {
    blocker.status = "blocked";
    render(<UnsavedChangesGuard dirty />);

    await userEvent.click(screen.getByRole("button", { name: "Leave" }));

    expect(blocker.proceed).toHaveBeenCalledTimes(1);
    expect(blocker.reset).not.toHaveBeenCalled();
  });

  it("cancels the navigation on Stay", async () => {
    blocker.status = "blocked";
    render(<UnsavedChangesGuard dirty />);

    await userEvent.click(screen.getByRole("button", { name: "Stay" }));

    expect(blocker.reset).toHaveBeenCalledTimes(1);
    expect(blocker.proceed).not.toHaveBeenCalled();
  });
});
