import { useState } from "react";

import { useDisplayLanguages } from "@/hooks/use-display-languages";

/** The server filters by the display languages while the URL names none; once it has named some, removing them sticks. */
export function useSearchWithDefaultLanguages<T extends { languages?: string[] }>(search: T): T {
  const displayLanguages = useDisplayLanguages();
  const [urlNamedLanguages, setUrlNamedLanguages] = useState(search.languages !== undefined);
  if (!urlNamedLanguages && search.languages !== undefined) {
    setUrlNamedLanguages(true);
  }
  if (urlNamedLanguages || search.languages !== undefined || displayLanguages.length === 0) {
    return search;
  }
  return { ...search, languages: [...displayLanguages] };
}
