import { withTimeout } from "@/lib/with-timeout";

// A blocked image request (offline, extension, stalled CDN) fires neither
// `load` nor `error`, so every wait is bounded.
const DEFAULT_IMAGE_TIMEOUT_MS = 10_000;

interface LoadImageOptions {
  crossOrigin?: "anonymous";
  timeoutMs?: number;
}

export function loadImage(src: string, options: LoadImageOptions = {}): Promise<HTMLImageElement> {
  const { crossOrigin, timeoutMs = DEFAULT_IMAGE_TIMEOUT_MS } = options;
  // oxlint-disable-next-line promise/avoid-new -- wrapping the HTMLImageElement load callbacks
  const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    if (crossOrigin) {
      image.crossOrigin = crossOrigin;
    }
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error("Image failed to load")));
    image.src = src;
  });
  return withTimeout(loaded, { label: "Image load", timeoutMs });
}
