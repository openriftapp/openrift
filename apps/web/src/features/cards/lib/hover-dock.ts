export type DockSide = "left" | "right";

/** Past this many px from the midline, the dock switches sides, so a cursor near center doesn't flap it. */
const DOCK_DEADBAND_PX = 48;

export function pickDockSide(
  cursorX: number,
  previous: DockSide | null,
  viewportWidth: number,
): DockSide {
  const middle = viewportWidth / 2;
  if (previous === null) {
    return cursorX < middle ? "right" : "left";
  }
  if (cursorX < middle - DOCK_DEADBAND_PX) {
    return "right";
  }
  if (cursorX > middle + DOCK_DEADBAND_PX) {
    return "left";
  }
  return previous;
}
