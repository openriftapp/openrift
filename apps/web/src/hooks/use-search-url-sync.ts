import { useEffect, useEffectEvent, useRef, useState } from "react";

interface Options {
  urlValue: string;
  onCommit: (value: string) => void;
  delay?: number;
}

/**
 * `onCommit` navigates asynchronously, so echoes of earlier commits can land after newer ones.
 * `pendingSent` holds commits not yet echoed; any other `urlValue` change is external.
 * A commit equal to `urlValue` gets no echo, so it clears the list.
 */
export function useSearchUrlSync({ urlValue, onCommit, delay = 200 }: Options) {
  const [localValue, setLocalValue] = useState(urlValue);

  const prevUrlValue = useRef(urlValue);
  const lastSentValue = useRef(urlValue);
  const pendingSent = useRef<string[]>([]);

  const commit = useEffectEvent((value: string) => {
    lastSentValue.current = value;
    pendingSent.current = value === urlValue ? [] : [...pendingSent.current, value];
    onCommit(value);
  });

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
