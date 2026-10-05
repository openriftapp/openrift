import { formatDayTime } from "@openrift/shared/format-date";
import type { CardLabels } from "@openrift/shared/scan/labels";
import {
  CameraIcon,
  CameraOffIcon,
  CircleIcon,
  CircleXIcon,
  LoaderIcon,
  RotateCcwIcon,
  SaveIcon,
  SquareIcon,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Code } from "@/components/ui/code";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { useClipRecorder } from "@/features/admin/hooks/use-clip-recorder";
import { useLatestJobRun } from "@/features/admin/hooks/use-latest-job-run";
import {
  REBUILD_SCAN_BANK_KIND,
  useRebuildScanBank,
} from "@/features/admin/hooks/use-scan-bank-admin";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import { ScanLoadRow } from "@/features/scan/components/scan-load-row";
import { useCardScanner } from "@/features/scan/hooks/use-card-scanner";
import { useScanBank } from "@/features/scan/hooks/use-scan-bank";
import { useScanEngine } from "@/features/scan/hooks/use-scan-engine";
import type { ScanServing } from "@/features/scan/hooks/use-scan-serving";
import { useScanServing } from "@/features/scan/hooks/use-scan-serving";
import type { CameraInfo, CameraInfoEntry } from "@/features/scan/lib/camera-info";
import { describeKey, isLandscapeKey } from "@/features/scan/lib/scan-bank";
import type { LockedCard } from "@/features/scan/lib/scan-locks";
import type { ScannerReadout } from "@/features/scan/lib/scan-readout";
import type { ScannerSettings } from "@/features/scan/lib/scan-session";
import { DEFAULT_SCANNER_SETTINGS } from "@/features/scan/lib/scan-session";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn, PAGE_WIDTH } from "@/lib/utils";

const MODES: { value: string; label: string }[] = [
  { value: "single", label: "Automatic (single cards, sweeps, copies on a stand)" },
  { value: "capture", label: "Single card, tap to scan (slow devices)" },
];

const PROCESSING_SIZES: { value: string; label: string }[] = [
  { value: "480", label: "480px (fastest)" },
  { value: "720", label: "720px" },
  { value: "848", label: "848px (clip parity, default)" },
  { value: "1080", label: "1080px (most detail)" },
];

const CANDIDATE_TRIES: { value: string; label: string }[] = [
  { value: "2", label: "2 (fastest)" },
  { value: "4", label: "4 (calibrated default)" },
];

function LocksCard({ locks, labels }: { locks: LockedCard[]; labels: CardLabels | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Locked</CardTitle>
      </CardHeader>
      <CardContent>
        {locks.length === 0 ? (
          <p className="text-muted-foreground">
            Nothing locked yet. A card locks once four sharp frames agree on it.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {locks.map((lock) => (
              <li key={`${lock.key}-${lock.at}`} className="flex items-center gap-3">
                <CardArtThumb
                  imageId={lock.key}
                  variant="120w"
                  className="w-10"
                  landscape={labels !== null && isLandscapeKey(labels, lock.key)}
                />
                <span className="flex-1">{lock.label}</span>
                <Badge variant="secondary" className="tabular-nums">
                  {lock.lockSeconds.toFixed(2)}s · {lock.framesToLock} frames · score {lock.score}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

interface LiveFrameCardProps {
  readout: ScannerReadout;
  labels: CardLabels | null;
  active: boolean;
}

function LiveFrameCard({ readout, labels, active }: LiveFrameCardProps) {
  const idleStatus = active ? "No confident card in view." : "Camera is off.";
  const frameStatus = readout.refused
    ? "Refused: the margin over the rival was too small."
    : idleStatus;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Live frame</CardTitle>
      </CardHeader>
      <CardContent>
        {readout.winnerKey !== null && labels !== null && (
          <p>
            <span className="font-medium">{describeKey(labels, readout.winnerKey)}</span>
            <span className="text-muted-foreground tabular-nums">
              {" "}
              · score {readout.winnerScore} vs rival {readout.rivalScore}
            </span>
          </p>
        )}
        {readout.winnerKey === null && <p className="text-muted-foreground">{frameStatus}</p>}
        {readout.ranked.length > 0 && labels !== null && (
          <ul className="mt-3 flex flex-col gap-2">
            {readout.ranked.map((entry) => (
              <li key={entry.key} className="flex items-center gap-2">
                <CardArtThumb
                  imageId={entry.key}
                  variant="120w"
                  className="w-9"
                  landscape={isLandscapeKey(labels, entry.key)}
                />
                <span className={entry.key === readout.winnerKey ? "flex-1 font-medium" : "flex-1"}>
                  {describeKey(labels, entry.key)}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {entry.distance.toFixed(3)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {readout.candidate && (
          <p className="text-muted-foreground mt-3 tabular-nums">
            quad: area {(readout.candidate.areaFraction * 100).toFixed(0)}%
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function CameraInfoRows({ entries }: { entries: CameraInfoEntry[] }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
      {entries.map(([key, value]) => (
        <Fragment key={key}>
          <dt className="text-muted-foreground">{key}</dt>
          <dd className="break-words tabular-nums">{value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/**
 * Requests `facingMode: environment`; on a multi-camera phone this can be the ultra-wide lens, not the main one.
 */
function CameraCard({ info, active }: { info: CameraInfo | null; active: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Camera</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {info === null ? (
          <p className="text-muted-foreground">
            Start the camera to see which lens the browser picked and what it can do.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <p className="font-medium break-words">{info.label ?? "Unnamed track"}</p>
              {!active && (
                <p className="text-muted-foreground">From the last session, camera is off.</p>
              )}
            </div>

            {info.settings.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="font-medium">Settings</p>
                <CameraInfoRows entries={info.settings} />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <p className="font-medium">Capabilities</p>
              {!info.capabilitiesSupported && (
                <p className="text-muted-foreground">
                  This browser does not expose getCapabilities, so zoom and focus cannot be read or
                  controlled here.
                </p>
              )}
              {info.capabilitiesSupported && info.capabilities.length === 0 && (
                <p className="text-muted-foreground">The track reported no capabilities.</p>
              )}
              {info.capabilities.length > 0 && <CameraInfoRows entries={info.capabilities} />}
            </div>

            {info.devices.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="font-medium">Video inputs ({info.devices.length})</p>
                <ul className="flex flex-col gap-1">
                  {info.devices.map((device) => (
                    <li key={device.deviceId} className="break-words">
                      {device.label === "" ? (
                        <span className="text-muted-foreground">Unnamed</span>
                      ) : (
                        device.label
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface EngineCardProps {
  settings: ScannerSettings;
  onChange: (settings: ScannerSettings) => void;
}

function EngineCard({ settings, onChange }: EngineCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Engine</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground">
          Margin, lock run and the verification shortlist run at the defaults calibrated on the real
          clips. Processing size applies right away; mode and candidates per frame apply when the
          camera is next started.
        </p>

        <div className="flex flex-col gap-2">
          <Label htmlFor="scan-mode">Mode</Label>
          <Select
            items={MODES}
            value={settings.mode}
            onValueChange={(value) =>
              onChange({ ...settings, mode: value as ScannerSettings["mode"] })
            }
          >
            <SelectTrigger id="scan-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODES.map((mode) => (
                <SelectItem key={mode.value} value={mode.value}>
                  {mode.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="scan-resolution">Processing size</Label>
          <Select
            items={PROCESSING_SIZES}
            value={String(settings.processingSize)}
            onValueChange={(value) => onChange({ ...settings, processingSize: Number(value) })}
          >
            <SelectTrigger id="scan-resolution">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROCESSING_SIZES.map((size) => (
                <SelectItem key={size.value} value={size.value}>
                  {size.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="scan-tries">Candidates per frame</Label>
          <Select
            items={CANDIDATE_TRIES}
            value={String(settings.candidatesToTry)}
            onValueChange={(value) => onChange({ ...settings, candidatesToTry: Number(value) })}
          >
            <SelectTrigger id="scan-tries">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CANDIDATE_TRIES.map((tries) => (
                <SelectItem key={tries.value} value={tries.value}>
                  {tries.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

function ServingCard({ serving }: { serving: ScanServing }) {
  const rebuild = useRebuildScanBank();
  const latestRun = useLatestJobRun(REBUILD_SCAN_BANK_KIND);
  const running = rebuild.isPending || latestRun.data?.status === "running";

  async function handleRebuild() {
    let started: Awaited<ReturnType<typeof rebuild.mutateAsync>>;
    try {
      started = await rebuild.mutateAsync();
    } catch {
      // Reported by the global mutation error toast.
      return;
    }
    if (started.status === "already_running") {
      toast.info("A rebuild is already running");
    } else {
      toast.success("Bank rebuild started");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Serving</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {serving.status === "loading" && (
          <p className="text-muted-foreground">Resolving the manifest…</p>
        )}
        {serving.status === "unavailable" && (
          <p className="text-muted-foreground">
            No server bank or card detector yet, so scanning is unavailable. Rebuild to publish the
            first generation (the encoder file must exist under media/scan first) and set{" "}
            <Code>SCAN_DETECTOR_FILE</Code> to a detector under media/scan.
          </p>
        )}
        {serving.status === "ready" && (
          <p className="text-muted-foreground tabular-nums">
            Server bank <Code>{serving.assets.bankHash}</Code> · {serving.assets.entryCount} entries
            {serving.assets.builtAt ? ` · built ${formatDayTime(serving.assets.builtAt)}` : ""}
          </p>
        )}
        {latestRun.data?.status === "failed" && (
          <p className="text-muted-foreground flex items-center gap-1.5">
            <CircleXIcon className="text-destructive size-4 shrink-0" />
            Last rebuild failed: {latestRun.data.errorMessage}
          </p>
        )}
        <div>
          <Button onClick={() => void handleRebuild()} disabled={running} variant="secondary">
            {running ? <LoaderIcon className="animate-spin" /> : <RotateCcwIcon />}
            Rebuild bank
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ScanTestPage() {
  const [settings, setSettings] = useState<ScannerSettings>(DEFAULT_SCANNER_SETTINGS);
  // True once the user has picked a mode themselves; the slow-device
  // auto-switch below must never fight an explicit choice.
  const [modeChosen, setModeChosen] = useState(false);
  // Held back until hydration: the route is server-rendered, and reading
  // navigator during SSR would mismatch an https client. Null means "not known yet".
  const hydrated = useHydrated();
  const cameraAvailable = hydrated ? navigator.mediaDevices?.getUserMedia !== undefined : null;

  const serving = useScanServing();
  const { assets, labels, unavailableMessage } = useScanBank();
  const labelsError = serving.status === "unavailable" ? null : unavailableMessage;
  const engine = useScanEngine(assets, labels);
  const {
    bank,
    engineReady,
    embedMsPerImage,
    slowDevice: deviceTooSlow,
    progress: engineProgress,
    threads,
  } = engine;

  const frameSinkRef = useRef<((sweeping: boolean) => void) | null>(null);
  const scannerEvents = {
    onFrame: (frame: { sweeping: boolean }) => frameSinkRef.current?.(frame.sweeping),
  };

  // Destructured before any JSX: member access on the hook's return object
  // during render makes the React Compiler bail with a refs-during-render error.
  const {
    videoRef,
    overlayRef,
    active,
    error: scanError,
    readout,
    cameraInfo,
    start,
    stop,
    capture,
    clearHistory,
  } = useCardScanner(engine, settings, scannerEvents);
  const {
    recording,
    pending: pendingClip,
    error: recordError,
    start: startRecording,
    stop: stopRecording,
    noteFrame,
    save: saveClip,
    discard: discardClip,
  } = useClipRecorder(videoRef);
  useEffect(() => {
    frameSinkRef.current = noteFrame;
  }, [noteFrame]);

  const ready = bank !== null && engineReady;
  // Lock ~ 3 agreeing frames at ~2.5x the per-image encoder cost each; see
  // SLOW_DEVICE_EMBED_MS for the measurements behind the factor.
  const predictedLockSeconds = Math.ceil((embedMsPerImage * 7.5) / 1000);

  if (deviceTooSlow && !modeChosen && settings.mode === "single") {
    setSettings((previous) => ({ ...previous, mode: "capture" }));
  }

  function handleSettingsChange(next: ScannerSettings): void {
    if (next.mode !== settings.mode) {
      setModeChosen(true);
    }
    setSettings(next);
  }

  function handleStart() {
    void start();
  }
  const pendingClipMb =
    pendingClip === null ? 0 : pendingClip.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024;

  function recorderContext() {
    return {
      mode: settings.mode,
      processingSize: settings.processingSize,
      locks: readout.locks,
    };
  }
  function handleStop() {
    if (recording) {
      stopRecording(recorderContext());
    }
    stop();
  }
  function handleRecord() {
    if (recording) {
      stopRecording(recorderContext());
    } else {
      startRecording();
    }
  }
  function handleSaveClip() {
    void saveClip();
  }
  function handleCapture() {
    void capture();
  }
  function handleClear() {
    clearHistory();
  }

  return (
    <>
      <AdminPageTopBar title="Scan Test" />
      <div className={cn(PAGE_WIDTH.capped, "px-safe pb-12")}>
        {deviceTooSlow && (
          <Card className="border-warning mt-4">
            <CardContent className="pt-6">
              <p className="font-medium">This device is too slow for live scanning.</p>
              <p className="text-muted-foreground mt-2">
                Recognising a card live would take roughly {predictedLockSeconds} seconds instead of
                under one
                {settings.mode === "capture" ? (
                  <>
                    , so the mode is set to <strong>tap to scan</strong>: aim with the guide as
                    usual and each tap scans one frame.
                  </>
                ) : (
                  <>
                    . Switch the mode to <strong>tap to scan</strong>: aim with the guide as usual
                    and each tap scans one frame.
                  </>
                )}
              </p>
            </CardContent>
          </Card>
        )}

        {labelsError && (
          <Card className="border-destructive mt-4">
            <CardContent className="pt-6">
              <p className="font-medium">{labelsError}</p>
            </CardContent>
          </Card>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex flex-col gap-3">
            <div className="bg-muted relative aspect-3/4 overflow-hidden rounded-lg sm:aspect-video">
              {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- live camera preview, no audio track */}
              <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
              <canvas
                ref={overlayRef}
                className="pointer-events-none absolute inset-0 h-full w-full"
              />
              {!active && (
                <div className="text-muted-foreground absolute inset-0 grid place-items-center px-6 text-center">
                  {ready ? (
                    `Ready — ${bank.keys.length} cards, bank ${(bank.bytes / 1024 / 1024).toFixed(1)} MB`
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <ScanLoadRow label="Card labels" done={labels !== null} />
                      <ScanLoadRow
                        label="Card bank"
                        done={engineReady}
                        progress={engineProgress.bank}
                      />
                      <ScanLoadRow
                        label="Encoder model"
                        done={engineReady}
                        progress={engineProgress.encoder}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {active ? (
                <Button onClick={handleStop} variant="secondary">
                  <CameraOffIcon />
                  Stop
                </Button>
              ) : (
                <Button onClick={handleStart} disabled={!ready || cameraAvailable !== true}>
                  <CameraIcon />
                  Start camera
                </Button>
              )}
              {active && settings.mode === "capture" && (
                <Button onClick={handleCapture}>
                  <CameraIcon />
                  Scan frame
                </Button>
              )}
              {active && (
                <Button onClick={handleRecord} variant={recording ? "destructive" : "secondary"}>
                  {recording ? <SquareIcon /> : <CircleIcon />}
                  {recording ? "Stop recording" : "Record clip"}
                </Button>
              )}
              {pendingClip && (
                <>
                  <Button onClick={handleSaveClip}>
                    <SaveIcon />
                    Save clip ({pendingClipMb.toFixed(1)} MB)
                  </Button>
                  <Button onClick={discardClip} variant="ghost">
                    Discard
                  </Button>
                </>
              )}
              <Button onClick={handleClear} variant="ghost">
                <RotateCcwIcon />
                Clear
              </Button>
              {active && (
                <span className="text-muted-foreground ml-auto tabular-nums">
                  {readout.fps} fps · {readout.totalMs.toFixed(0)}ms (detect{" "}
                  {readout.detectMs.toFixed(0)}, embed {readout.embedMs.toFixed(0)}, verify{" "}
                  {readout.verifyMs.toFixed(0)}) · focus {readout.focus.toFixed(0)} ·{" "}
                  {readout.placements} placed
                  {readout.missedPlacements > 0 && ` (${readout.missedPlacements} uncounted)`}
                  {readout.settling && " · settling"}
                </span>
              )}
            </div>

            {threads !== null && (
              <p className="text-muted-foreground">
                {threads === 1 ? "1 thread" : `${threads} threads`}
              </p>
            )}

            {recordError && (
              <p className="text-muted-foreground flex items-center gap-1.5">
                <CircleXIcon className="text-destructive size-4 shrink-0" />
                {recordError}
              </p>
            )}
            {scanError && (
              <p className="text-muted-foreground flex items-center gap-1.5">
                <CircleXIcon className="text-destructive size-4 shrink-0" />
                {scanError}
              </p>
            )}
            {cameraAvailable === false && (
              <p className="text-muted-foreground">
                The camera needs a secure context, so it is unavailable over a plain http:// dev
                server. Open the site over https (a tunnel, or Chrome&apos;s
                <Code className="mx-1">unsafely-treat-insecure-origin-as-secure</Code>
                flag).
              </p>
            )}

            <LocksCard locks={readout.locks} labels={labels} />
          </div>

          <div className="flex flex-col gap-4">
            <LiveFrameCard readout={readout} labels={labels} active={active} />
            <CameraCard info={cameraInfo} active={active} />
            <EngineCard settings={settings} onChange={handleSettingsChange} />
            <ServingCard serving={serving} />
          </div>
        </div>
      </div>
    </>
  );
}
