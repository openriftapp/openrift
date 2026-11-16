import type { DeckFormatConfig, DeckLink } from "@openrift/shared/types/api/deck";
import type { DeckFormat, DeckZone } from "@openrift/shared/types/enums";

const LOCAL_DECK_PREFIX = "local:";

export function bareLocalDeckId(id: string): string {
  return id.startsWith(LOCAL_DECK_PREFIX) ? id.slice(LOCAL_DECK_PREFIX.length) : id;
}

export interface LocalDeckCard {
  zone: DeckZone;
  cardId: string;
  quantity: number;
  preferredPrintingId: string | null;
}

export interface LocalDeckPatch {
  name?: string;
  description?: string | null;
  format?: DeckFormat;
  formatConfig?: DeckFormatConfig | null;
  coverCardId?: string | null;
  coverFaceId?: string | null;
  coverPosition?: number | null;
  links?: DeckLink[];
}

export interface LocalDeck {
  id: string;
  name: string;
  description: string;
  format: DeckFormat;
  formatConfig: DeckFormatConfig | null;
  cards: LocalDeckCard[];
  coverCardId: string | null;
  coverFaceId: string | null;
  coverPosition: number | null;
  links: DeckLink[];
  createdAt: string;
  updatedAt: string;
}
