import { useRef, useState } from "react";

export function useDraftRevision() {
  const revision = useRef(0);
  const [dirty, setDirty] = useState(false);

  const markEdited = () => {
    revision.current += 1;
    setDirty(true);
  };

  const beginSave = () => {
    const saved = revision.current;
    return () => {
      if (revision.current === saved) {
        setDirty(false);
      }
    };
  };

  return { dirty, markEdited, beginSave, reset: () => setDirty(false) };
}
