import { formatFileStamp } from "@openrift/shared/format-date";
import type { BenchRun } from "@openrift/shared/scan/bench-score";
import { summarize } from "@openrift/shared/scan/bench-score";
import type { CardLabels } from "@openrift/shared/scan/labels";
import { GaugeIcon, LoaderIcon, SaveIcon, TimerIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Code } from "@/components/ui/code";
import type { SpeedSummary } from "@/features/admin/lib/scan-device-bench";
import type {
  BenchAssets,
  BenchJob,
  DeviceRunKind,
  SpeedRun,
} from "@/features/admin/lib/scan-device-bench-run";
import { postDeviceRun, runBench, runSpeedCheck } from "@/features/admin/lib/scan-device-bench-run";
import { deliverFiles } from "@/features/admin/lib/scan-recorder";
import { createScanWorkerClient } from "@/features/scan/lib/scan-worker-client";
import { downloadBlob } from "@/lib/download";
import { errorText } from "@/lib/error-text";

const JOB_FAILURE: Record<DeviceRunKind, string> = {
  bench: "The bench failed",
  speed: "The speed check failed",
};

function speedLine(label: string, summary: SpeedSummary | null): string | null {
  if (!summary) {
    return null;
  }
  return `${label}: ${summary.frame.mean.toFixed(0)} ms per frame (p90 ${summary.frame.p90.toFixed(0)}) · detect ${summary.stageMs.detect.toFixed(1)}, embed ${summary.stageMs.embed.toFixed(1)} (crop ${summary.stageMs.crop.toFixed(1)}), verify ${summary.stageMs.verify.toFixed(1)}, printing ${summary.stageMs.printing.toFixed(1)} · ${summary.frames} frames`;
}

async function requestWakeLock(): Promise<WakeLockSentinel | null> {
  try {
    return await navigator.wakeLock.request("screen");
  } catch {
    // Unsupported or refused: the run still works if the screen stays on by itself.
    return null;
  }
}

function releaseWakeLock(wakeLock: WakeLockSentinel | null): void {
  if (wakeLock) {
    void wakeLock.release();
  }
}

interface ScanDeviceBenchCardProps {
  assets: BenchAssets | null;
  labels: CardLabels | null;
}

export function ScanDeviceBenchCard({ assets, labels }: ScanDeviceBenchCardProps) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<BenchRun | null>(null);
  const [speed, setSpeed] = useState<SpeedRun | null>(null);
  const [savedAs, setSavedAs] = useState<string | null>(null);

  async function runJob<T>(
    kind: DeviceRunKind,
    job: (input: BenchJob) => Promise<T>,
    show: (result: T | null) => void,
  ) {
    if (!assets || !labels) {
      return;
    }
    const failure = JOB_FAILURE[kind];
    setRunning(true);
    setError(null);
    show(null);
    const client = createScanWorkerClient();
    const wakeLock = await requestWakeLock();
    try {
      const result = await job({ assets, labels, client, onProgress: setProgress });
      show(result);
      setSavedAs(await postDeviceRun(kind, result));
      setProgress(null);
      client.terminate();
      releaseWakeLock(wakeLock);
      setRunning(false);
    } catch (runError) {
      setError(errorText(runError, failure));
      client.terminate();
      releaseWakeLock(wakeLock);
      setRunning(false);
    }
  }

  async function handleSave() {
    if (!run) {
      return;
    }
    const file = new File(
      [`${JSON.stringify(run, null, 2)}\n`],
      `scan-device-bench-${formatFileStamp(new Date())}.json`,
      { type: "application/json" },
    );
    await deliverFiles([file], navigator, (saved) => downloadBlob(saved, saved.name));
  }

  const speedLines = speed
    ? [speedLine("Aimed clips", speed.aimed), speedLine("Sweep clips", speed.sweep)].filter(
        (line) => line !== null,
      )
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Device bench</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-muted-foreground">
          Replays the recorded clips at this device&apos;s speed, dropping frames that arrive while
          one is still processing. Publish clips with{" "}
          <Code>bun scripts/scan/export-bench-pack.ts</Code>.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void runJob("bench", runBench, setRun)}
            disabled={running || !assets || !labels}
          >
            {running ? <LoaderIcon className="animate-spin" /> : <GaugeIcon />}
            Run bench
          </Button>
          <Button
            onClick={() => void runJob("speed", runSpeedCheck, setSpeed)}
            disabled={running || !assets || !labels}
            variant="secondary"
          >
            <TimerIcon />
            Speed check
          </Button>
          {run && (
            <Button onClick={() => void handleSave()} variant="secondary">
              <SaveIcon />
              Save result
            </Button>
          )}
        </div>
        {progress && <p className="text-muted-foreground tabular-nums">{progress}</p>}
        {savedAs && <p className="text-muted-foreground">Saved on the dev box as {savedAs}</p>}
        {speed && (
          <div className="flex flex-col gap-1 tabular-nums">
            <p className="font-medium">
              Speed check ·{" "}
              {speed.meta.threads === 1 ? "1 thread" : `${String(speed.meta.threads)} threads`}
            </p>
            {speedLines.map((line) => (
              <p key={line} className="text-muted-foreground">
                {line}
              </p>
            ))}
          </div>
        )}
        {error && <p className="text-destructive">{error}</p>}
        {run && (
          <ul className="flex flex-col gap-2 tabular-nums">
            {run.clips.map((clip) => {
              const arrival = summarize(clip.score.arrivalToLock);
              const wrong = clip.score.wrongCards + clip.score.wrongPrintings;
              return (
                <li key={clip.clip}>
                  <p className="font-medium">{clip.clip}</p>
                  <p className="text-muted-foreground">
                    found {clip.score.found}/{clip.score.expected} · wrong {wrong} · frame{" "}
                    {clip.frameMs.mean.toFixed(0)}ms (p90 {clip.frameMs.p90.toFixed(0)}) ·{" "}
                    {clip.processed}/{clip.frames} frames
                    {clip.score.arrivalToLock.length > 0 &&
                      ` · arrival-to-lock p50 ${arrival.p50.toFixed(2)}s p90 ${arrival.p90.toFixed(2)}s`}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
