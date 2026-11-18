import { describe, expect, it, vi } from "vitest";

import {
  SignalledVariables,
  sentVariables,
  withSignal,
  withWriteSignal,
  WriteTimedOutError,
} from "./write-signal";

describe("withWriteSignal", () => {
  it("resolves with the request's result", async () => {
    expect(await withWriteSignal(new AbortController().signal, async () => "saved")).toBe("saved");
  });

  it("rejects a request that failed after its signal aborted as timed out", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      withWriteSignal(controller.signal, () =>
        Promise.reject(new DOMException("aborted", "AbortError")),
      ),
    ).rejects.toBeInstanceOf(WriteTimedOutError);
  });

  it("passes any other failure through", async () => {
    const failure = new Error("Network down");

    await expect(
      withWriteSignal(new AbortController().signal, () => Promise.reject(failure)),
    ).rejects.toBe(failure);
    await expect(withWriteSignal(undefined, () => Promise.reject(failure))).rejects.toBe(failure);
  });
});

describe("sentVariables", () => {
  it("unwraps the variables of a call that carried a signal and passes others through", () => {
    const signal = new AbortController().signal;

    expect(sentVariables(new SignalledVariables("image-1", signal))).toBe("image-1");
    expect(sentVariables("image-1")).toBe("image-1");
  });
});

describe("withSignal", () => {
  it("binds the signal to every call", async () => {
    const signal = new AbortController().signal;
    const mutateAsync = vi.fn(async (id: string, _options?: { signal?: AbortSignal }) => id);

    expect(await withSignal(mutateAsync, signal)("card-1")).toBe("card-1");
    expect(mutateAsync).toHaveBeenCalledWith("card-1", { signal });
  });
});
