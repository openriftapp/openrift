import type { ComponentProps, ReactNode, Ref } from "react";
import { useState } from "react";

function assignRef<T>(ref: Ref<T> | undefined, node: T | null): void | (() => void) {
  if (typeof ref === "function") {
    return ref(node);
  }
  if (ref) {
    ref.current = node;
  }
}

/**
 * An `<img>` that renders `fallback` instead when it has no source or once the
 * image fails to load (missing on the server, network error), so a broken image
 * looks the same as a missing one. The failure is keyed by `src`, so a reused instance that
 * receives a new URL attempts it fresh. The ref covers fetches that settle
 * before React attaches the error listener (e.g. under SSR) — a broken image
 * reports `complete` with naturalWidth 0.
 *
 * @returns The image, or the fallback once the source has failed.
 */
export function ImgWithFallback({
  fallback,
  alt,
  ref,
  onError,
  ...imgProps
}: ComponentProps<"img"> & { fallback: ReactNode; alt: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const { src } = imgProps;
  if (src === undefined || src === "" || src === failedSrc) {
    return fallback;
  }
  const markFailed = () => setFailedSrc(src ?? null);
  return (
    <img
      {...imgProps}
      alt={alt}
      ref={(node) => {
        if (node?.complete && node.naturalWidth === 0) {
          markFailed();
        }
        return assignRef(ref, node);
      }}
      onError={(event) => {
        markFailed();
        onError?.(event);
      }}
    />
  );
}
