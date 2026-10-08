export const SCAN_ZOOMS = [1, 1.5, 2] as const;

interface VideoRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function zoomRegion(videoWidth: number, videoHeight: number, zoom: number): VideoRegion {
  const factor = Math.max(zoom, 1);
  const width = videoWidth / factor;
  const height = videoHeight / factor;
  return { x: (videoWidth - width) / 2, y: (videoHeight - height) / 2, width, height };
}

interface VideoLayoutBox {
  left: number;
  top: number;
  width: number;
  height: number;
  zoom: number;
}

/** The video's box before its zoom transform, which scales it about its centre. */
export function videoLayoutBox(video: HTMLVideoElement): VideoLayoutBox {
  const rect = video.getBoundingClientRect();
  const width = video.offsetWidth || rect.width;
  const height = video.offsetHeight || rect.height;
  return {
    left: rect.left + (rect.width - width) / 2,
    top: rect.top + (rect.height - height) / 2,
    width,
    height,
    zoom: width > 0 ? Math.max(1, rect.width / width) : 1,
  };
}
