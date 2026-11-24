import type { SyntheticEvent } from "react";
import { useState } from "react";

interface LoadedSize {
  url: string;
  width: number;
  height: number;
}

/** Natural pixel size of the image at `url`, or null until that url has loaded. */
export function useLoadedImageSize(url: string | null) {
  const [loaded, setLoaded] = useState<LoadedSize | null>(null);
  const size = loaded !== null && loaded.url === url ? loaded : null;
  const onLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (url !== null) {
      setLoaded({ url, width: img.naturalWidth, height: img.naturalHeight });
    }
  };
  return { size, onLoad };
}
