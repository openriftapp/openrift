import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ScannerReadout } from "@/features/scan/lib/scan-readout";
import { EMPTY_READOUT } from "@/features/scan/lib/scan-readout";

import { useScanAimIdentify } from "./use-scan-aim-identify";

function readoutAiming(artKey: string, seconds: number, winnerKey: string | null = null) {
  return {
    ...EMPTY_READOUT,
    aim: { artKey, key: `${artKey}-en`, seconds },
    winnerKey,
  } satisfies ScannerReadout;
}

function render(readout: ScannerReadout, onIdentify: () => void, active = true, blocked = false) {
  return renderHook(
    (props: { readout: ScannerReadout; active: boolean; blocked: boolean }) =>
      useScanAimIdentify({ ...props, onIdentify }),
    { initialProps: { readout, active, blocked } },
  );
}

describe("useScanAimIdentify", () => {
  it("opens the sheet once the aim streak passes the threshold", () => {
    const onIdentify = vi.fn();
    const { rerender } = render(readoutAiming("art-1", 1), onIdentify);
    expect(onIdentify).not.toHaveBeenCalled();

    rerender({ readout: readoutAiming("art-1", 3.2), active: true, blocked: false });
    expect(onIdentify).toHaveBeenCalledTimes(1);
  });

  it("does not reopen for the same artwork after the sheet is dismissed", () => {
    const onIdentify = vi.fn();
    const { rerender } = render(readoutAiming("art-1", 3.2), onIdentify);
    rerender({ readout: readoutAiming("art-1", 4.5), active: true, blocked: false });
    expect(onIdentify).toHaveBeenCalledTimes(1);
  });

  it("opens again for a different artwork", () => {
    const onIdentify = vi.fn();
    const { rerender } = render(readoutAiming("art-1", 3.2), onIdentify);
    rerender({ readout: readoutAiming("art-2", 3.4), active: true, blocked: false });
    expect(onIdentify).toHaveBeenCalledTimes(2);
  });

  it("stays shut while the engine has a winner", () => {
    const onIdentify = vi.fn();
    render(readoutAiming("art-1", 5, "art-1-en"), onIdentify);
    expect(onIdentify).not.toHaveBeenCalled();
  });

  it("stays shut while blocked or stopped", () => {
    const onIdentify = vi.fn();
    render(readoutAiming("art-1", 5), onIdentify, true, true);
    render(readoutAiming("art-1", 5), onIdentify, false, false);
    expect(onIdentify).not.toHaveBeenCalled();
  });

  it("offers an artwork again after the camera is restarted", () => {
    const onIdentify = vi.fn();
    const { rerender } = render(readoutAiming("art-1", 3.2), onIdentify);
    rerender({ readout: EMPTY_READOUT, active: false, blocked: false });
    rerender({ readout: readoutAiming("art-1", 3.2), active: true, blocked: false });
    expect(onIdentify).toHaveBeenCalledTimes(2);
  });
});
