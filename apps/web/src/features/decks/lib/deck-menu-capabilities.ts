export type DeckMenuSource = "server" | "local";

export interface DeckMenuCapabilities {
  pin: boolean;
  present: boolean;
  folders: boolean;
  variants: boolean;
  primary: boolean;
  draft: boolean;
  archive: boolean;
}

const SERVER: DeckMenuCapabilities = {
  pin: true,
  present: true,
  folders: true,
  variants: true,
  primary: true,
  draft: true,
  archive: true,
};

const LOCAL: DeckMenuCapabilities = {
  pin: false,
  present: false,
  folders: false,
  variants: false,
  primary: false,
  draft: false,
  archive: false,
};

export function deckMenuCapabilities(source: DeckMenuSource): DeckMenuCapabilities {
  return source === "server" ? SERVER : LOCAL;
}
