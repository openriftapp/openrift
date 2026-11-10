// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadImage } from "./load-image";
import { TimeoutError } from "./with-timeout";

type Listener = () => void;

const state: { outcome: "load" | "error" | "never" } = { outcome: "load" };
const created: FakeImage[] = [];

class FakeImage {
  crossOrigin: string | null = null;
  private readonly listeners = new Map<string, Listener>();
  private source = "";

  constructor() {
    created.push(this);
  }

  addEventListener(event: string, listener: Listener) {
    this.listeners.set(event, listener);
  }

  get src(): string {
    return this.source;
  }

  set src(value: string) {
    this.source = value;
    if (state.outcome === "never") {
      return;
    }
    globalThis.setTimeout(() => this.listeners.get(state.outcome)?.(), 0);
  }
}

beforeEach(() => {
  state.outcome = "load";
  created.length = 0;
  vi.stubGlobal("Image", FakeImage);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("loadImage", () => {
  it("resolves with the loaded image", async () => {
    const image = await loadImage("/card.png");

    expect(image).toBe(created[0]);
    expect(created[0]?.src).toBe("/card.png");
  });

  it("sets crossOrigin only when asked", async () => {
    await loadImage("/a.png");
    await loadImage("/b.png", { crossOrigin: "anonymous" });

    expect(created.map((image) => image.crossOrigin)).toEqual([null, "anonymous"]);
  });

  it("rejects when the image fails to load", async () => {
    state.outcome = "error";

    await expect(loadImage("/card.png")).rejects.toThrow("Image failed to load");
  });

  it("rejects with a TimeoutError when the request never settles", async () => {
    state.outcome = "never";
    vi.useFakeTimers();

    const rejects = expect(loadImage("/card.png", { timeoutMs: 2000 })).rejects.toBeInstanceOf(
      TimeoutError,
    );
    await vi.advanceTimersByTimeAsync(2000);

    await rejects;
  });

  it("bounds a stalled request by default", async () => {
    state.outcome = "never";
    vi.useFakeTimers();

    const rejects = expect(loadImage("/card.png")).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(10_000);

    await rejects;
  });
});
