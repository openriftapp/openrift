import type { ImageQuad } from "@openrift/shared/contracts/admin/card-images";
import type { Point } from "@openrift/shared/scan/types";

import { imageToDisplayScale } from "@/features/admin/lib/straighten-quad";
import { cn } from "@/lib/utils";

const LOUPE_SIZE = 144;
const LOUPE_ZOOM = 5;

export function StraightenLoupe({
  url,
  point,
  quad,
  width,
  height,
  displayWidth,
}: {
  url: string;
  point: Point;
  quad: ImageQuad;
  width: number;
  height: number;
  displayWidth: number;
}) {
  const displayScale = imageToDisplayScale(width, displayWidth);
  const scale = displayScale * LOUPE_ZOOM;
  const offset = {
    left: LOUPE_SIZE / 2 - point.x * scale,
    top: LOUPE_SIZE / 2 - point.y * scale,
  };
  const size = { width: width * scale, height: height * scale };

  return (
    <div
      className={cn(
        "border-border bg-muted absolute top-2 overflow-hidden rounded-md border shadow-md",
        "pointer-events-none",
        point.x * displayScale < displayWidth / 2 ? "right-2" : "left-2",
      )}
      style={{ width: LOUPE_SIZE, height: LOUPE_SIZE }}
    >
      <img
        src={url}
        alt=""
        style={{ imageOrientation: "none", ...offset, ...size }}
        className="absolute max-w-none"
      />
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="absolute"
        style={{ ...offset, ...size }}
        aria-hidden
      >
        <polygon
          points={quad.map((corner) => `${corner.x},${corner.y}`).join(" ")}
          className="stroke-primary fill-none"
          strokeWidth={1 / scale}
        />
      </svg>
      <div className="bg-foreground/40 absolute top-1/2 right-0 left-0 h-px" />
      <div className="bg-foreground/40 absolute top-0 bottom-0 left-1/2 w-px" />
    </div>
  );
}
