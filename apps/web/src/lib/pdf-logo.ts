/**
 * Shared OpenRift logo raster for the jsPDF documents (proxy sheets,
 * registration sheets, binder QR sheets). jsPDF cannot embed SVG, so the mark
 * is drawn into a canvas once per session and cached as a PNG data URL.
 */

import { loadImage } from "@/lib/load-image";

const LOGO_RASTER_PX = 512;
const LOGO_LOAD_TIMEOUT_MS = 3000;

let cachedLogoDataUrl: string | null = null;

export async function loadLogoDataUrl(): Promise<string> {
  if (cachedLogoDataUrl) {
    return cachedLogoDataUrl;
  }

  const img = await loadImage("/logo-color.svg", { timeoutMs: LOGO_LOAD_TIMEOUT_MS });

  const canvas = document.createElement("canvas");
  canvas.width = LOGO_RASTER_PX;
  canvas.height = LOGO_RASTER_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas 2d context");
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  cachedLogoDataUrl = canvas.toDataURL("image/png");
  return cachedLogoDataUrl;
}
