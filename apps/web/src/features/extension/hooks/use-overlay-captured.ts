import { useEffect, useState } from "react";

import {
  isSnapshotCaptured,
  OVERLAY_CAPTURED_ATTRIBUTE,
} from "@/features/extension/lib/overlay-captured";

/** Whether the extension has stored the snapshot the page is showing right now. */
export function useOverlayCaptured(generatedAt: string | undefined): boolean {
  const [capturedGeneratedAt, setCapturedGeneratedAt] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setCapturedGeneratedAt(root.getAttribute(OVERLAY_CAPTURED_ATTRIBUTE));
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: [OVERLAY_CAPTURED_ATTRIBUTE] });
    return () => observer.disconnect();
  }, []);

  return generatedAt !== undefined && isSnapshotCaptured(capturedGeneratedAt, generatedAt);
}
