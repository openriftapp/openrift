import { beforeEach, describe, expect, it, vi } from "vitest";

const warn = vi.hoisted(() => vi.fn());
vi.mock("@openrift/shared/logger", () => ({ createLogger: () => ({ warn }) }));

import { recordNewPrintingEvent } from "./record-printing-event.js";

describe("recordNewPrintingEvent", () => {
  beforeEach(() => {
    warn.mockClear();
  });

  it("logs a failed insert at warn without rethrowing", async () => {
    const error = new Error("deadlock detected");
    const repo = { recordNew: vi.fn(() => Promise.reject(error)) };

    await expect(recordNewPrintingEvent(repo as never, "pr-1")).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      { err: error, printingId: "pr-1" },
      "new-printing event insert failed",
    );
  });

  it("logs nothing when the insert succeeds", async () => {
    const repo = { recordNew: vi.fn(() => Promise.resolve()) };

    await recordNewPrintingEvent(repo as never, "pr-1");
    expect(warn).not.toHaveBeenCalled();
  });
});
