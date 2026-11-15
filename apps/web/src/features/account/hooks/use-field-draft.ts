import type { InputEvent } from "react";
import { useEffect, useRef, useState } from "react";

/**
 * Tracks an uncontrolled field's text for display (a Save gate, a counter). The mount
 * read picks up text typed before hydration; nothing is ever written to the field.
 */
export function useFieldDraft<T extends HTMLInputElement | HTMLTextAreaElement>() {
  const ref = useRef<T>(null);
  const [draft, setDraft] = useState<string>();

  useEffect(() => {
    if (ref.current) {
      setDraft(ref.current.value);
    }
  }, []);

  function handleInput(event: InputEvent<T>) {
    setDraft(event.currentTarget.value);
  }

  return { ref, draft, handleInput };
}
