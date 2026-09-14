let readPreferred: () => readonly string[] = () => [];

// lib/ cannot import stores/, so the display store registers its read here.
export function setPreferredCatalogLanguages(read: () => readonly string[]): void {
  readPreferred = read;
}

export function preferredCatalogLanguages(): readonly string[] {
  return readPreferred();
}
