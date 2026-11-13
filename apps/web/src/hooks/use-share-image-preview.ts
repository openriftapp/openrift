import { useState } from "react";

import { m } from "@/paraglide/messages.js";

export interface ShareImagePreview {
  /** Changes on retry, so the image element remounts and asks the route again. */
  key: string;
  src: string;
  loading: boolean;
  error?: string;
  onLoad: () => void;
  onError: () => void;
  retry: () => void;
}

/** An `<img>` error carries no status, so one request tells a rate limit from any other failure. */
async function failureMessage(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    return response.status === 429 ? m.share_image_rate_limited() : m.share_image_error();
  } catch {
    return m.share_image_error();
  }
}

export function useShareImagePreview(url: string): ShareImagePreview {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{ key: string; error?: string } | null>(null);
  const key = `${url}#${attempt}`;
  const current = settled?.key === key ? settled : null;

  const handleError = async () => {
    const error = await failureMessage(url);
    setSettled({ key, error });
  };

  return {
    key,
    src: url,
    loading: current === null,
    error: current?.error,
    onLoad: () => setSettled({ key }),
    onError: () => void handleError(),
    retry: () => setAttempt((count) => count + 1),
  };
}
