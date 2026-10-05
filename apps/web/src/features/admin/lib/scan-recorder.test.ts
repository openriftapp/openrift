import { describe, expect, it } from "vitest";

import {
  buildClipMeta,
  clipFileBase,
  deliverFiles,
  pickRecordingMimeType,
  recordingExtension,
} from "@/features/admin/lib/scan-recorder";
import type { LockedCard } from "@/features/scan/lib/scan-locks";

function lock(at: number, key = "ahri"): LockedCard {
  return {
    key,
    artKey: `${key}-art`,
    label: key,
    resolved: true,
    at,
    lockSeconds: 0.4,
    framesToLock: 3,
    score: 40,
  };
}

describe("pickRecordingMimeType", () => {
  it("prefers H.264 in mp4", () => {
    expect(pickRecordingMimeType(() => true)).toBe("video/mp4;codecs=avc1");
  });

  it("falls back to webm where mp4 is unsupported", () => {
    expect(pickRecordingMimeType((type) => type.startsWith("video/webm"))).toBe(
      "video/webm;codecs=vp9",
    );
  });

  it("returns null when nothing is supported", () => {
    expect(pickRecordingMimeType(() => false)).toBeNull();
  });
});

describe("recordingExtension", () => {
  it("maps the container to a file extension", () => {
    expect(recordingExtension("video/mp4;codecs=avc1")).toBe("mp4");
    expect(recordingExtension("video/webm;codecs=vp9")).toBe("webm");
  });
});

describe("clipFileBase", () => {
  it("names the clip by its UTC start time and mode", () => {
    expect(clipFileBase(new Date("2026-10-03T09:30:12.456Z"), "single")).toBe(
      "scan-clip-2026-10-03T09-30-12-single",
    );
  });
});

describe("deliverFiles", () => {
  const files = [new File(["a"], "clip.mp4"), new File(["b"], "clip.json")];

  it("uses the share sheet when it accepts files", async () => {
    const shared: File[][] = [];
    const downloaded: File[] = [];
    const result = await deliverFiles(
      files,
      {
        canShare: () => true,
        share: async (data) => {
          shared.push(data.files);
        },
      },
      (file) => downloaded.push(file),
    );
    expect(result).toBe("shared");
    expect(shared).toEqual([files]);
    expect(downloaded).toEqual([]);
  });

  it("downloads each file when sharing files is unsupported", async () => {
    const downloaded: File[] = [];
    const result = await deliverFiles(files, { canShare: () => false }, (file) =>
      downloaded.push(file),
    );
    expect(result).toBe("downloaded");
    expect(downloaded).toEqual(files);
  });

  it("stops when the user dismisses the share sheet", async () => {
    const downloaded: File[] = [];
    const result = await deliverFiles(
      files,
      {
        canShare: () => true,
        share: () => Promise.reject(new DOMException("dismissed", "AbortError")),
      },
      (file) => downloaded.push(file),
    );
    expect(result).toBe("cancelled");
    expect(downloaded).toEqual([]);
  });

  it("falls back to downloads when sharing fails", async () => {
    const downloaded: File[] = [];
    const result = await deliverFiles(
      files,
      {
        canShare: () => true,
        share: () => Promise.reject(new DOMException("blocked", "NotAllowedError")),
      },
      (file) => downloaded.push(file),
    );
    expect(result).toBe("downloaded");
    expect(downloaded).toEqual(files);
  });
});

describe("buildClipMeta", () => {
  const base = {
    startedAt: 10_000,
    stoppedAt: 25_000,
    mode: "single" as const,
    processingSize: 848,
    mimeType: "video/mp4",
    userAgent: "test",
    camera: {},
    locks: [],
  };

  it("measures the duration in seconds", () => {
    const meta = buildClipMeta(base);
    expect(meta.durationSeconds).toBe(15);
    expect(meta.recordedAt).toBe(new Date(10_000).toISOString());
  });

  it("keeps only the locks inside the recording, timed from its start", () => {
    const meta = buildClipMeta({
      ...base,
      locks: [lock(9000, "before"), lock(12_500, "inside"), lock(26_000, "after")],
    });
    expect(meta.locks).toEqual([
      { seconds: 2.5, key: "inside", label: "inside", framesToLock: 3, score: 40 },
    ]);
  });

  it("drops camera settings that are not plain values", () => {
    const meta = buildClipMeta({
      ...base,
      camera: { width: 1920, deviceId: "abc", torch: false, pointsOfInterest: [{ x: 1 }] },
    });
    expect(meta.camera).toEqual({ width: 1920, deviceId: "abc", torch: false });
  });

  it("reports the share of frames spent sweeping", () => {
    const meta = buildClipMeta({ ...base, frames: { processed: 40, sweeping: 10 } });
    expect(meta.sweepShare).toBe(0.25);
  });

  it("reports a zero share when no frame was processed", () => {
    expect(buildClipMeta({ ...base, frames: { processed: 0, sweeping: 0 } }).sweepShare).toBe(0);
  });

  it("omits the share when frames were not counted", () => {
    expect(buildClipMeta(base)).not.toHaveProperty("sweepShare");
  });
});
