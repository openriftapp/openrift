/**
 * Browser-only export plumbing for the card designer: rasterize a rendered
 * card element to a PNG via html2canvas-pro, then download or copy it.
 */
import { downloadBlob } from "@/lib/download";
import { captureElementCanvas } from "@/lib/html-capture";

/** px */
export const CARD_EXPORT_WIDTH = 750;

export type ExportAction = "download" | "copy";
export type ExportOutcome = "downloaded" | "copied";

async function captureCardPng(element: HTMLElement): Promise<Blob> {
  const canvas = await captureElementCanvas(element);
  // oxlint-disable-next-line promise/avoid-new -- wrapping the canvas.toBlob callback API
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
  if (!blob) {
    throw new Error("Failed to rasterize the card.");
  }
  return blob;
}

async function copyImageToClipboard(blob: Blob): Promise<boolean> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    return false;
  }
  const result = await navigator.clipboard
    .write([new ClipboardItem({ "image/png": blob })])
    .then(() => true)
    .catch(() => false);
  return result;
}

// Copy falls back to a download when the clipboard is unavailable.
export async function exportCardImage(
  element: HTMLElement,
  action: ExportAction,
  filename: string,
): Promise<ExportOutcome> {
  await (document.fonts?.ready ?? Promise.resolve());
  const blob = await captureCardPng(element);
  if (action === "copy" && (await copyImageToClipboard(blob))) {
    return "copied";
  }
  downloadBlob(blob, filename);
  return "downloaded";
}
