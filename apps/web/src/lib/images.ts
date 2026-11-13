export function needsCssRotation(orientation: string): boolean {
  return orientation === "landscape";
}

/** The landscape width ratio lets the -90deg rotation fill the portrait box. */
export const LANDSCAPE_ROTATION_STYLE: React.CSSProperties = {
  width: "calc(100% * var(--aspect-card-landscape))",
  aspectRatio: "var(--aspect-card-landscape)",
  transform: "translate(-50%, -50%) rotate(-90deg)",
};
