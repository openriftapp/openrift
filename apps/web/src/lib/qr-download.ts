import { qrPngDataUri } from "@openrift/shared/qr";

/** Rendered at the download resolution: `qrcode` scales by redrawing, so a small code blown up would blur. */
export async function downloadQrPng(value: string, filename: string, width = 1024): Promise<void> {
  const dataUri = await qrPngDataUri(value, { width });
  const anchor = document.createElement("a");
  anchor.href = dataUri;
  anchor.download = filename;
  anchor.click();
}
