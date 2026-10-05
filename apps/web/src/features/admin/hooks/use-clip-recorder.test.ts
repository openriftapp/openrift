import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useClipRecorder } from "./use-clip-recorder";

type Listener = (event: { data: Blob }) => void;

class FakeMediaStream {
  getVideoTracks() {
    return [{ getSettings: () => ({ width: 1920, deviceId: "back" }) }];
  }
}

class FakeRecorder {
  static instances: FakeRecorder[] = [];
  static isTypeSupported(type: string): boolean {
    return type === "video/webm";
  }

  state: "inactive" | "recording" = "inactive";
  private readonly listeners = new Map<string, Listener[]>();

  constructor() {
    FakeRecorder.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  start(): void {
    this.state = "recording";
  }

  stop(): void {
    this.state = "inactive";
    for (const listener of this.listeners.get("dataavailable") ?? []) {
      listener({ data: new Blob(["frames"]) });
    }
    for (const listener of this.listeners.get("stop") ?? []) {
      listener({ data: new Blob() });
    }
  }
}

const context = { mode: "single" as const, processingSize: 848, locks: [] };

function videoRef(stream: unknown) {
  return { current: { srcObject: stream } as unknown as HTMLVideoElement };
}

beforeEach(() => {
  FakeRecorder.instances = [];
  vi.stubGlobal("MediaStream", FakeMediaStream);
  vi.stubGlobal("MediaRecorder", FakeRecorder);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useClipRecorder", () => {
  it("start without a camera stream sets an error", () => {
    const { result } = renderHook(() => useClipRecorder(videoRef(null)));
    act(() => result.current.start());
    expect(result.current.recording).toBe(false);
    expect(result.current.error).toMatch(/camera/u);
  });

  it("start reports a browser that supports none of the recording formats", () => {
    class NoFormatRecorder extends FakeRecorder {
      static override isTypeSupported(): boolean {
        return false;
      }
    }
    vi.stubGlobal("MediaRecorder", NoFormatRecorder);
    const { result } = renderHook(() => useClipRecorder(videoRef(new FakeMediaStream())));

    act(() => result.current.start());

    expect(result.current.recording).toBe(false);
    expect(result.current.error).toBe("This browser cannot record video.");
    expect(FakeRecorder.instances).toHaveLength(0);
  });

  it("start reports why the browser refused to create a recorder", () => {
    class RefusingRecorder {
      static isTypeSupported(): boolean {
        return true;
      }

      constructor() {
        throw new Error("Unsupported bitrate");
      }
    }
    vi.stubGlobal("MediaRecorder", RefusingRecorder);
    const { result } = renderHook(() => useClipRecorder(videoRef(new FakeMediaStream())));

    act(() => result.current.start());

    expect(result.current.recording).toBe(false);
    expect(result.current.error).toBe("Unsupported bitrate");
    expect(result.current.pending).toBeNull();
  });

  it("stop yields the clip and its metadata", async () => {
    const { result } = renderHook(() => useClipRecorder(videoRef(new FakeMediaStream())));
    act(() => result.current.start());
    expect(result.current.recording).toBe(true);
    act(() => result.current.stop(context));

    expect(result.current.recording).toBe(false);
    expect(result.current.error).toBeNull();
    const [clip, meta] = result.current.pending ?? [];
    expect(clip?.name).toMatch(/^scan-clip-.*-single\.webm$/u);
    expect(clip?.type).toBe("video/webm");
    expect(meta?.name).toMatch(/^scan-clip-.*-single\.json$/u);
    const parsed = JSON.parse((await meta?.text()) ?? "null");
    expect(parsed).toMatchObject({
      version: 1,
      mode: "single",
      processingSize: 848,
      mimeType: "video/webm",
      camera: { width: 1920, deviceId: "back" },
      locks: [],
    });
  });

  it("a cancelled share keeps the pending files", async () => {
    vi.stubGlobal("navigator", {
      userAgent: "test",
      canShare: () => true,
      share: () => Promise.reject(new DOMException("dismissed", "AbortError")),
    });
    const { result } = renderHook(() => useClipRecorder(videoRef(new FakeMediaStream())));
    act(() => result.current.start());
    act(() => result.current.stop(context));
    const pending = result.current.pending;

    await act(() => result.current.save());

    expect(pending).toHaveLength(2);
    expect(result.current.pending).toBe(pending);
  });

  it("a recording the browser ends on its own reports the lost clip", () => {
    const { result } = renderHook(() => useClipRecorder(videoRef(new FakeMediaStream())));
    act(() => result.current.start());
    act(() => result.current.stop(context));
    act(() => result.current.discard());
    act(() => result.current.start());

    act(() => FakeRecorder.instances.at(-1)?.stop());

    expect(result.current.recording).toBe(false);
    expect(result.current.pending).toBeNull();
    expect(result.current.error).toMatch(/camera ended/u);
  });

  it("records the share of frames noted as sweeping", async () => {
    const { result } = renderHook(() => useClipRecorder(videoRef(new FakeMediaStream())));
    act(() => result.current.noteFrame(true));
    act(() => result.current.start());
    act(() => {
      result.current.noteFrame(true);
      result.current.noteFrame(false);
      result.current.noteFrame(false);
      result.current.noteFrame(false);
    });
    act(() => result.current.stop(context));
    act(() => result.current.noteFrame(true));

    const meta = result.current.pending?.[1];
    expect(JSON.parse((await meta?.text()) ?? "null").sweepShare).toBe(0.25);
  });

  it("records a zero share when no frame was noted", async () => {
    const { result } = renderHook(() => useClipRecorder(videoRef(new FakeMediaStream())));
    act(() => result.current.start());
    act(() => result.current.stop(context));

    const meta = result.current.pending?.[1];
    expect(JSON.parse((await meta?.text()) ?? "null").sweepShare).toBe(0);
  });
});
