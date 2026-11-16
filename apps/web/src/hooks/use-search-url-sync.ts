import { useEffect, useEffectEvent, useRef, useState } from "react";

interface Options {
  urlValue: string;
  onCommit: (value: string) => void;
  delay?: number;
}

/**
 * `onCommit` triggers an async navigate, so `urlValue` lags behind. `lastSentValue`
 * lets a commit-echoing `urlValue` update be told apart from a real external change.
 */
export function useSearchUrlSync({ urlValue, onCommit, delay = 200 }: Options) {
  const [localValue, setLocalValue] = useState(urlValue);

  const prevUrlValue = useRef(urlValue);
  const lastSentValue = useRef(urlValue);

  const commit = useEffectEvent((value: string) => {
    lastSentValue.current = value;
    onCommit(value);
  });

  useEffect(() => {
    if (urlValue === prevUrlValue.current) {
      return;
    }
    prevUrlValue.current = urlValue;
    if (urlValue !== lastSentValue.current) {
      lastSentValue.current = urlValue;
      setLocalValue(urlValue);
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
