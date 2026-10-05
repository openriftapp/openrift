import { CameraIcon, CameraOffIcon, ScanSearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScanShutter } from "@/features/scan/components/scan-shutter";
import type { AimHint } from "@/features/scan/lib/scan-aim-hint";
import { OVER_VIDEO } from "@/features/scan/lib/scan-styles";
import { m } from "@/paraglide/messages.js";

interface ScanControlsProps {
  hint: AimHint | null;
  active: boolean;
  immersive: boolean;
  shutter: boolean;
  ready: boolean;
  cameraAvailable: boolean | null;
  captureMode: boolean;
  onStart: () => void;
  onStop: () => void;
  onCapture: () => void;
  onIdentifyNow: () => void;
}

export function ScanControls({
  hint,
  active,
  immersive,
  shutter,
  ready,
  cameraAvailable,
  captureMode,
  onStart,
  onStop,
  onCapture,
  onIdentifyNow,
}: ScanControlsProps) {
  return (
    <>
      {hint && (
        <p key={hint.kind} className="rounded-full bg-black/60 px-3 py-1 text-sm text-white">
          {hint.message}
        </p>
      )}
      {!active && immersive && !shutter && (
        <Button size="lg" disabled={!ready || cameraAvailable !== true} onClick={onStart}>
          <CameraIcon />
          {m.scan_controls_start_camera()}
        </Button>
      )}
      {active && shutter && (
        <ScanShutter
          icon={<ScanSearchIcon />}
          label={captureMode ? m.scan_controls_scan_card() : m.scan_controls_identify_now()}
          onClick={captureMode ? onCapture : onIdentifyNow}
        />
      )}
      {active && !shutter && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {captureMode ? (
            <Button size="lg" onClick={onCapture}>
              <CameraIcon />
              {m.scan_controls_scan_card()}
            </Button>
          ) : (
            <Button size="lg" onClick={onIdentifyNow}>
              <ScanSearchIcon />
              {m.scan_controls_identify_now()}
            </Button>
          )}
          <Button variant="ghost" onClick={onStop} className={OVER_VIDEO}>
            <CameraOffIcon />
            {m.scan_controls_stop()}
          </Button>
        </div>
      )}
    </>
  );
}
