import { useState } from "react";

import type { JsonParseResult } from "@/features/admin/lib/json-upload";

export interface JsonFileInput<T> {
  fileName: string | null;
  value: T | null;
  error: string | null;
  load: (file: File) => Promise<void>;
  reset: () => void;
}

export function useJsonFileInput<T>(parse: (text: string) => JsonParseResult<T>): JsonFileInput<T> {
  const [fileName, setFileName] = useState<string | null>(null);
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(file: File) {
    setFileName(file.name);
    setError(null);
    setValue(null);
    let text: string;
    try {
      text = await file.text();
    } catch {
      setError("Could not read that file");
      return;
    }
    const parsed = parse(text);
    if (parsed.ok) {
      setValue(parsed.value);
    } else {
      setError(parsed.error);
    }
  }

  function reset() {
    setFileName(null);
    setValue(null);
    setError(null);
  }

  return { fileName, value, error, load, reset };
}
