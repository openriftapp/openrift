import { useState } from "react";

/** Both flags are tied to the URL they were reported for, so a new card starts from the thumbnail again. */
export function useProgressiveCardImage(thumbnailUrl: string | null, fullUrl: string | null) {
  const [failedThumbnailUrl, setFailedThumbnailUrl] = useState<string | null>(null);
  const [loadedFullUrl, setLoadedFullUrl] = useState<string | null>(null);
  return {
    thumbnailFailed: thumbnailUrl !== null && thumbnailUrl === failedThumbnailUrl,
    fullLoaded: fullUrl !== null && fullUrl === loadedFullUrl,
    onThumbnailError: () => setFailedThumbnailUrl(thumbnailUrl),
    onFullLoad: () => setLoadedFullUrl(fullUrl),
  };
}
