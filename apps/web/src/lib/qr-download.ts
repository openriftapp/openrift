import { qrPngDataUri } from "@openrift/shared/qr";

import { downloadUrl } from "@/lib/download";

/** Rendered at the download resolution: `qrcode` scales by redrawing, so a small code blown up would blur. */
export async function downloadQrPng(value: string, filename: string, width = 1024): Promise<void> {
  downloadUrl(await qrPngDataUri(value, { width }), filename);
}
