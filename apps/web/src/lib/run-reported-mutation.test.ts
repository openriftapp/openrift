import { describe, expect, it, vi } from "vitest";

import { runReportedMutation } from "./run-reported-mutation";

describe("runReportedMutation", () => {
  it("resolves true after the action resolves", async () => {
    const action = vi.fn().mockResolvedValue("ok");
    await expect(runReportedMutation(action)).resolves.toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("resolves false (not rejects) when the action rejects", async () => {
    const action = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(runReportedMutation(action)).resolves.toBe(false);
  });

  it("hands the rejection to onFailure so a form can show it inline", async () => {
    const failure = new Error("Slug already taken");
    const onFailure = vi.fn();
    await expect(runReportedMutation(() => Promise.reject(failure), onFailure)).resolves.toBe(
      false,
    );
    expect(onFailure).toHaveBeenCalledWith(failure);
  });

  it("leaves onFailure alone when the action succeeds", async () => {
    const onFailure = vi.fn();
    await runReportedMutation(() => Promise.resolve(), onFailure);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("awaits the action before resolving", async () => {
    let settled = false;
    async function action() {
      await Promise.resolve();
      settled = true;
    }
    const pending = runReportedMutation(action);
    expect(settled).toBe(false);
    await pending;
    expect(settled).toBe(true);
  });
});
