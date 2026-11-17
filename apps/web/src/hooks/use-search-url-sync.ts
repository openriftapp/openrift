import { useEffect, useEffectEvent, useRef, useState } from "react";

interface Options {
  urlValue: string;
  onCommit: (value: string) => void;
  delay?: number;
}

/**
 * `onCommit` navigates asynchronously, so echoes of earlier commits can land after newer ones.
 * `pendingSent` holds commits not yet echoed; any other `urlValue` change is external.
 * A history traversal supersedes every pending commit, so it clears the list. An external push
 * to a value still pending is indistinguishable from its late echo and is ignored.
 */
export function useSearchUrlSync({ urlValue, onCommit, delay = 200 }: Options) {
  const [localValue, setLocalValue] = useState(urlValue);

  const prevUrlValue = useRef(urlValue);
  const lastSentValue = useRef(urlValue);
  const pendingSent = useRef<string[]>([]);

  const commit = useEffectEvent((value: string) => {
    lastSentValue.current = value;
    if (value !== urlValue || pendingSent.current.length > 0) {
      pendingSent.current = [...pendingSent.current, value];
    }
    onCommit(value);
  });

  useEffect(() => {
    const clearPending = () => {
      pendingSent.current = [];
    };
    globalThis.addEventListener("popstate", clearPending);
    return () => globalThis.removeEventListener("popstate", clearPending);
  }, []);

  useEffect(() => {
    if (urlValue === prevUrlValue.current) {
      return;
    }
    prevUrlValue.current = urlValue;
    const echoIndex = pendingSent.current.indexOf(urlValue);
    if (echoIndex === -1) {
      pendingSent.current = [];
      lastSentValue.current = urlValue;
      setLocalValue(urlValue);
    } else {
      pendingSent.current = pendingSent.current.slice(echoIndex + 1);
    }
  }, [urlValue]);

  useEffect(() => {
    if (localValue === lastSentValue.current) {
      return;
    }
    const timer = setTimeout(() => commit(localValue), delay);
    return () => clearTimeout(timer);
  }, [localValue, delay]);

  return [localValue, setLocalValue] as const;
}
