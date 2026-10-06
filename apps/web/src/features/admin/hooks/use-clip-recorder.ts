import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";

import {
  RECORDING_BITRATE,
  buildClipMeta,
  clipFileBase,
  deliverFiles,
  pickRecordingMimeType,
  recordingExtension,
} from "@/features/admin/lib/scan-recorder";
import type { ClipFrame } from "@/features/admin/lib/scan-recorder";
import type { FrameLogEntry } from "@/features/scan/lib/scan-frame-log";
import type { LockedCard } from "@/features/scan/lib/scan-locks";
import type { ScannerMode } from "@/features/scan/lib/scan-session";
import { downloadBlob } from "@/lib/download";
import { errorText } from "@/lib/error-text";

/** Milliseconds. */
const RECORDER_TIMESLICE = 1000;

interface ClipRecorderContext {
  mode: ScannerMode;
  processingSize: number;
  locks: readonly LockedCard[];
}

export interface ClipRecorder {
  recording: boolean;
  pending: File[] | null;
  error: string | null;
  start: (restart: () => Promise<void>) => Promise<void>;
  stop: (context: ClipRecorderContext) => void;
  noteFrame: (frame: FrameLogEntry) => void;
  save: () => Promise<void>;
  discard: () => void;
}

function createRecorder(stream: MediaStream, mimeType: string): MediaRecorder | string {
  try {
    return new MediaRecorder(stream, { mimeType, videoBitsPerSecond: RECORDING_BITRATE });
  } catch (error) {
    return errorText(error, "This browser cannot record video.");
  }
}

export function useClipRecorder(videoRef: RefObject<HTMLVideoElement | null>): ClipRecorder {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const contextRef = useRef<ClipRecorderContext | null>(null);
  const framesRef = useRef<ClipFrame[]>([]);
  const startedAtRef = useRef(0);
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState<File[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
    },
    [],
  );

  async function start(restart: () => Promise<void>): Promise<void> {
    const stream = videoRef.current?.srcObject;
    if (!(stream instanceof MediaStream) || typeof MediaRecorder === "undefined") {
      setError("Start the camera first; this browser may not support recording.");
      return;
    }
    const mimeType = pickRecordingMimeType((type) => MediaRecorder.isTypeSupported(type));
    if (mimeType === null) {
      setError("This browser cannot record video.");
      return;
    }
    const recorder = createRecorder(stream, mimeType);
    if (typeof recorder === "string") {
      setError(recorder);
      return;
    }
    const chunks: Blob[] = [];
    const startedAt = Date.now();
    const camera = stream.getVideoTracks()[0]?.getSettings() ?? {};
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    });
    recorder.addEventListener("stop", () => {
      const context = contextRef.current;
      if (!context) {
        if (recorderRef.current === recorder) {
          recorderRef.current = null;
          setError("Recording stopped because the camera ended; the clip was not saved.");
        }
        setRecording(false);
        return;
      }
      const base = clipFileBase(new Date(startedAt), context.mode);
      const meta = buildClipMeta({
        startedAt,
        stoppedAt: Date.now(),
        mode: context.mode,
        processingSize: context.processingSize,
        mimeType,
        userAgent: navigator.userAgent,
        camera: { ...camera },
        locks: context.locks,
        frames: framesRef.current,
      });
      setPending([
        new File(chunks, `${base}.${recordingExtension(mimeType)}`, { type: mimeType }),
        new File([`${JSON.stringify(meta, null, 2)}\n`], `${base}.json`, {
          type: "application/json",
        }),
      ]);
      setRecording(false);
    });
    setError(null);
    setPending(null);
    await restart();
    recorderRef.current = recorder;
    contextRef.current = null;
    framesRef.current = [];
    startedAtRef.current = performance.now();
    recorder.start(RECORDER_TIMESLICE);
    setRecording(true);
  }

  function stop(context: ClipRecorderContext): void {
    contextRef.current = context;
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  function noteFrame(frame: FrameLogEntry): void {
    if (recorderRef.current === null) {
      return;
    }
    const { grabbedAt, ...entry } = frame;
    framesRef.current.push({ seconds: (grabbedAt - startedAtRef.current) / 1000, ...entry });
  }

  async function save(): Promise<void> {
    if (!pending) {
      return;
    }
    // navigator.share needs a fresh user gesture.
    const result = await deliverFiles(pending, navigator, (file) => downloadBlob(file, file.name));
    if (result !== "cancelled") {
      setPending(null);
    }
  }

  function discard(): void {
    setPending(null);
  }

  return { recording, pending, error, start, stop, noteFrame, save, discard };
}
