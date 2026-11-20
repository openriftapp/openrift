import { useEffect, useRef, useState } from "react";

const RESET_DELAY_MS = 1500;

interface UseCopyToClipboard {
  copied: boolean;
  copy: (text: string) => Promise<boolean>;
  reset: () => void;
}

export async function copyTextToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

async function settled(promise: Promise<unknown>): Promise<boolean> {
  try {
    await promise;
  } catch {
    return false;
  }
  return true;
}

async function writeTextWhenReady(text: Promise<string>): Promise<void> {
  // Safari drops the click's user activation while the text is fetched, so the
  // write starts inside the click and the browser waits for the text.
  if (typeof ClipboardItem !== "undefined" && typeof navigator.clipboard.write === "function") {
    const blob = (async () => new Blob([await text], { type: "text/plain" }))();
    // The browser may refuse the write without ever reading the item.
    void settled(blob);
    await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
    return;
  }
  await navigator.clipboard.writeText(await text);
}

export async function copyPendingText(text: Promise<string>): Promise<boolean> {
  try {
    await writeTextWhenReady(text);
  } catch {
    return false;
  }
  return true;
}

/** A denied or unavailable write returns false; it never throws. */
export function useCopyToClipboard(): UseCopyToClipboard {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current !== null) {
      globalThis.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  useEffect(
    () => () => {
      if (timer.current !== null) {
        globalThis.clearTimeout(timer.current);
      }
    },
    [],
  );

  const copy = async (text: string): Promise<boolean> => {
    try {
      await copyTextToClipboard(text);
    } catch {
      return false;
    }
    setCopied(true);
    clearTimer();
    timer.current = globalThis.setTimeout(() => setCopied(false), RESET_DELAY_MS);
    return true;
  };

  const reset = () => {
    clearTimer();
    setCopied(false);
  };

  return { copied, copy, reset };
}
