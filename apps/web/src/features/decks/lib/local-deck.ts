import type { DeckFormatConfig, DeckLink } from "@openrift/shared/types/api/deck";
import type { DeckFormat, DeckZone } from "@openrift/shared/types/enums";

export const LOCAL_DECK_PREFIX = "local:";

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
  coverPrintingId?: string | null;
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
  coverPrintingId: string | null;
  coverPosition: number | null;
  links: DeckLink[];
  createdAt: string;
  updatedAt: string;
}
