import { useState } from "react";

export interface RecordSelection {
  selected: ReadonlySet<string>;
  handleToggle: (key: string, checked: boolean) => void;
  clear: () => void;
}

export function useRecordSelection(): RecordSelection {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  function handleToggle(key: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }
  return { selected, handleToggle, clear: () => setSelected(new Set()) };
}
