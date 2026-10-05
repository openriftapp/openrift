export function cardPath(slug: string): string {
  return `/cards/${encodeURIComponent(slug)}`;
}

export function groupPath(slug: string, section?: string): string {
  const base = `/groups/${encodeURIComponent(slug)}`;
  return section ? `${base}/${encodeURIComponent(section)}` : base;
}

export function deckImportPath(code?: string): string {
  return code === undefined ? "/decks/import" : `/decks/import?code=${encodeURIComponent(code)}`;
}

export function rulesPath(kind: string, version?: string | number, lang?: string): string {
  const base = `/rules/${encodeURIComponent(kind)}`;
  const versioned = version === undefined ? base : `${base}/${encodeURIComponent(String(version))}`;
  return lang ? `${versioned}?lang=${encodeURIComponent(lang)}` : versioned;
}
