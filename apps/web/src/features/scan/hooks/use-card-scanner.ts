import type { RgbaImage } from "@openrift/shared/scan/types";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { cameraErrorMessage } from "@/features/scan/lib/camera-error";
import type { CameraInfo } from "@/features/scan/lib/camera-info";
import { readCameraInfo } from "@/features/scan/lib/camera-info";
import { acquireScannerStream } from "@/features/scan/lib/scan-camera";
import { grabRotatedFrame } from "@/features/scan/lib/scan-frame-grab";
import type { ScannerEvents } from "@/features/scan/lib/scan-locks";
import { createScanRun } from "@/features/scan/lib/scan-run";
import type { ScannerMode, ScannerSettings } from "@/features/scan/lib/scan-session";
import { lockRunForMode } from "@/features/scan/lib/scan-session";
import { errorText } from "@/lib/error-text";
import { m } from "@/paraglide/messages.js";

import { useScanBoard } from "./use-scan-board";
import { useScanCatchUp } from "./use-scan-catchup";
import type { ScanEngineHandle } from "./use-scan-engine";
import { useScanFrames } from "./use-scan-frames";
import { useScanOverlay } from "./use-scan-overlay";
import { useScanPlacements } from "./use-scan-placements";

export function useCardScanner(
  engine: ScanEngineHandle,
  settings: ScannerSettings,
  events?: ScannerEvents,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const workCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runningRef = useRef(false);
  const startingRef = useRef(false);
  // Bumped by stop, unmount and a mode switch. A start that was awaiting the
  // camera when the bump happened must not bring the stream up.
  const runGenerationRef = useRef(0);
  const frameInFlightRef = useRef<Promise<unknown> | null>(null);
  const settingsRef = useRef(settings);
  const eventsRef = useRef(events);
  const runRef = useRef(createScanRun(settings.mode));
  const preparedBankRef = useRef<string | null>(null);

  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Deliberately kept past stop().
  const [cameraInfo, setCameraInfo] = useState<CameraInfo | null>(null);

  function grabFrame(video: HTMLVideoElement): RgbaImage | null {
    // Written long-hand: the React Compiler cannot lower `??=` and bails out of
    // the whole hook if it sees one.
    if (!workCanvasRef.current) {
      workCanvasRef.current = document.createElement("canvas");
    }
    return grabRotatedFrame(
      video,
      workCanvasRef.current,
      settingsRef.current.processingSize,
      runRef.current.rotation.turns(),
    );
  }

  const overlay = useScanOverlay({ videoRef, runGenerationRef });

  const catchUp = useScanCatchUp({
    bank: engine.bank,
    videoRef,
    runningRef,
    runGenerationRef,
    runRef,
    eventsRef,
    grabFrame,
    processFrame: engine.processFrame,
  });

  const board = useScanBoard({
    bank: engine.bank,
    videoRef,
    runGenerationRef,
    runRef,
    eventsRef,
    readBoard: engine.readBoard,
  });

  const placements = useScanPlacements({
    videoRef,
    runGenerationRef,
    runRef,
    grabFrame,
    rearm: engine.rearm,
    onMiss: catchUp.enqueue,
  });

  const frames = useScanFrames({
    bank: engine.bank,
    videoRef,
    runningRef,
    runGenerationRef,
    settingsRef,
    eventsRef,
    runRef,
    setFrameInFlight: (frame: Promise<unknown>) => {
      frameInFlightRef.current = frame;
    },
    idleGate: engine.idleGate,
    grabFrame,
    hasSession: engine.hasSession,
    processFrame: engine.processFrame,
    setOverlayTarget: overlay.setTarget,
    shouldCatchUp: catchUp.shouldRun,
    runCatchUp: catchUp.run,
    noteBoardSurvey: board.noteSurvey,
    onError: setError,
  });

  // Written in an effect, not during render, so the React Compiler doesn't
  // bail out of the whole hook.
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Same treatment for the lock callbacks: consumers pass fresh closures per
  // render, and the loop must always call the latest without restarting.
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(
    () => () => {
      runGenerationRef.current++;
      runningRef.current = false;
      for (const track of streamRef.current?.getTracks() ?? []) {
        track.stop();
      }
      streamRef.current = null;
    },
    [],
  );

  function launch(generation: number): void {
    const mode = runRef.current.mode;
    board.reset();
    placements.begin(generation);
    overlay.begin(generation);
    const video = videoRef.current;
    if (video) {
      const scale = Math.min(
        1,
        settingsRef.current.processingSize / Math.max(video.videoWidth, video.videoHeight),
      );
      overlay.setTarget({
        quad: null,
        guide: true,
        frameWidth: Math.round(video.videoWidth * scale),
        frameHeight: Math.round(video.videoHeight * scale),
        turns: 0,
        focus: 0,
        runLength: 0,
        lockRun: lockRunForMode(mode),
      });
    }
    if (mode !== "capture") {
      frames.startLoop();
    }
  }

  function stop() {
    runGenerationRef.current++;
    runningRef.current = false;
    runRef.current.reset(performance.now());
    setActive(false);
    frames.resetAimHint();
    overlay.clear();
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  async function start() {
    // The Start button stays enabled until the camera opens; without this a
    // double tap leaks the first call's stream.
    if (startingRef.current || runningRef.current) {
      return;
    }
    startingRef.current = true;
    const generation = runGenerationRef.current;
    setError(null);

    // A failed previous start can leave a stream behind (play() rejected after
    // the camera opened); release it before opening a new one.
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    streamRef.current = null;

    const plan = settingsRef.current;
    const inFlight = frameInFlightRef.current;
    let prepared = false;
    let prepareFailure: string | null = null;
    try {
      prepared = await engine.prepare(plan, inFlight);
    } catch (prepareError) {
      prepareFailure = errorText(prepareError, m.scan_engine_start_failed());
    }
    if (generation !== runGenerationRef.current) {
      startingRef.current = false;
      return;
    }
    if (prepareFailure !== null) {
      setError(prepareFailure);
      startingRef.current = false;
      return;
    }
    catchUp.reset();
    runRef.current.reset(performance.now());
    runRef.current.update({ mode: plan.mode });
    if (!prepared) {
      setError(m.scan_engine_still_loading());
      startingRef.current = false;
      return;
    }
    preparedBankRef.current = engine.bankKey;

    // The React Compiler bails out of the whole hook on a `finally` clause or
    // on conditionals/loops inside try/catch, so control flow stays outside.
    const acquired = await acquireScannerStream(engine.slowDevice);
    const stream = acquired.stream;
    if (stream === null) {
      setError(cameraErrorMessage(acquired.failure, m.scan_camera_open_failed()));
      startingRef.current = false;
      return;
    }

    if (generation !== runGenerationRef.current) {
      // Stop was pressed or the page unmounted while the permission prompt
      // was open; without this the camera light stays on with no way off.
      for (const track of stream.getTracks()) {
        track.stop();
      }
      startingRef.current = false;
      return;
    }
    streamRef.current = stream;

    const video = videoRef.current;
    let playFailure: string | null = null;
    if (video) {
      video.srcObject = stream;
      try {
        await video.play();
      } catch (playError) {
        playFailure = errorText(playError, m.scan_camera_preview_failed());
      }
    }
    if (playFailure !== null) {
      setError(playFailure);
      for (const track of stream.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
      startingRef.current = false;
      return;
    }

    runningRef.current = true;
    setActive(true);
    console.log(
      `[scan] START mode ${plan.mode} processingSize ${plan.processingSize} candidatesToTry ${plan.candidatesToTry}` +
        ` video ${video?.videoWidth ?? 0}x${video?.videoHeight ?? 0}`,
    );
    launch(generation);
    startingRef.current = false;

    // Read last, so enumerateDevices never delays the first frame; it never
    // rejects, so needs no guard of its own.
    const info = await readCameraInfo(stream);
    if (streamRef.current === stream) {
      setCameraInfo(info);
    }
  }

  async function switchMode(mode: ScannerMode): Promise<void> {
    runGenerationRef.current++;
    const generation = runGenerationRef.current;
    runRef.current.update({ mode, switching: true });
    const plan = { ...settingsRef.current, mode };
    const inFlight = frameInFlightRef.current;
    let prepared = false;
    let prepareFailure: string | null = null;
    try {
      prepared = await engine.prepare(plan, inFlight);
    } catch (prepareError) {
      prepareFailure = errorText(prepareError, m.scan_engine_start_failed());
    }
    if (generation !== runGenerationRef.current) {
      return;
    }
    if (prepareFailure !== null) {
      stop();
      setError(prepareFailure);
      return;
    }
    if (!prepared) {
      stop();
      setError(m.scan_engine_still_loading());
      return;
    }
    preparedBankRef.current = engine.bankKey;
    console.log(`[scan] MODE ${mode}`);
    runRef.current.resetSession(performance.now());
    catchUp.clearQueue();
    launch(generation);
  }

  const onModeChange = useEffectEvent((mode: ScannerMode) => {
    if (runRef.current.mode !== mode) {
      void switchMode(mode);
    }
  });

  useEffect(() => {
    if (active) {
      onModeChange(settings.mode);
    }
  }, [active, settings.mode]);

  // The reloaded worker has no sessions yet, and the running loop still holds the old labels.
  const onBankReload = useEffectEvent((bankKey: string | null) => {
    if (bankKey !== null && preparedBankRef.current !== bankKey) {
      void switchMode(runRef.current.mode);
    }
  });

  useEffect(() => {
    if (active) {
      onBankReload(engine.bankKey);
    }
  }, [active, engine.bankKey]);

  return {
    videoRef,
    overlayRef: overlay.overlayRef,
    active,
    error: engine.error ?? error,
    readout: frames.readout,
    cameraInfo,
    start,
    stop,
    capture: frames.capture,
    identifyNow: catchUp.identifyNow,
    clearHistory: frames.clearHistory,
    unidentified: catchUp.pending,
    dismissUnidentified: catchUp.dismiss,
  };
}
