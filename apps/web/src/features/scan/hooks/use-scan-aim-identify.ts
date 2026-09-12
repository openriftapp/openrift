import { useEffect, useRef } from "react";

import type { ScannerReadout } from "@/features/scan/lib/scan-readout";

const AIM_SUGGEST_SECONDS = 3;

interface ScanAimIdentifyOptions {
  active: boolean;
  blocked: boolean;
  readout: ScannerReadout;
  onIdentify: () => void;
}

/**
 * Holding one artwork at the top of the ranking without the engine locking it
 * opens the identify sheet by itself. Once per artwork: a sheet the user
 * dismissed stays closed until a different card is aimed at.
 */
export function useScanAimIdentify({
  active,
  blocked,
  readout,
  onIdentify,
}: ScanAimIdentifyOptions): void {
  const offeredRef = useRef<string | null>(null);

  const aim = readout.aim;
  const due =
    active &&
    !blocked &&
    aim !== null &&
    aim.seconds >= AIM_SUGGEST_SECONDS &&
    readout.winnerKey === null
      ? aim.artKey
      : null;

  useEffect(() => {
    if (!active) {
      offeredRef.current = null;
      return;
    }
    if (due === null || offeredRef.current === due) {
      return;
    }
    offeredRef.current = due;
    onIdentify();
  }, [active, due, onIdentify]);
}
