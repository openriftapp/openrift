/** Set on `<html>` by the extension, holding the `generatedAt` of the snapshot it stored. */
export const OVERLAY_CAPTURED_ATTRIBUTE = "data-openrift-overlay-captured";

export function isSnapshotCaptured(
  capturedGeneratedAt: string | null | undefined,
  generatedAt: string,
): boolean {
  return generatedAt.length > 0 && capturedGeneratedAt === generatedAt;
}
