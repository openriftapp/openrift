export interface PackPrinting {
  id: string;
  printingId: string;
  cardId: string;
  cardName: string;
  cardSlug: string;
  cardTypes: string[];
  cardSuperTypes: string[];
  tags: string[];
  rarity: string;
  finish: string;
  artVariant: string;
  isSigned: boolean;
  isOvernumbered: boolean;
  language: string;
  shortCode: string;
  publicCode: string;
  setSlug: string;
}

export interface PackPull {
  slot: string;
  outcome: string;
  printing: PackPrinting;
}

export interface PackResult {
  pulls: PackPull[];
}
