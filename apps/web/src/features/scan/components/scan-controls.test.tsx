import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScanControls } from "@/features/scan/components/scan-controls";

function renderControls({ immersive, shutter }: { immersive: boolean; shutter: boolean }) {
  return render(
    <ScanControls
      hint={null}
      active
      immersive={immersive}
      shutter={shutter}
      ready
      cameraAvailable
      captureMode={false}
      onStart={vi.fn()}
      onStop={vi.fn()}
      onCapture={vi.fn()}
      onIdentifyNow={vi.fn()}
    />,
  );
}

describe("ScanControls", () => {
  it("leaves Stop to the top bar in immersive landscape", () => {
    renderControls({ immersive: true, shutter: false });

    expect(screen.getByRole("button", { name: /identify/iu })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
  });

  it("offers Stop beside the identify button in the boxed layout", () => {
    renderControls({ immersive: false, shutter: false });

    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
  });
});
