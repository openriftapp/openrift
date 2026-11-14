import { rulesTeaser } from "./rules-teaser.js";

// The connector anchors are placed on this printing's frame layout.
export const DEVELOPERS_SHOWCASE = {
  cardSlug: "annie-fiery",
  publicCode: "OGS-001/024",
} as const;

const RULES_TEASER_WORDS = 17;

export interface DevelopersShowcaseFacts {
  name: string;
  energy: number | null;
  tags: string[];
  domains: string[];
  rulesText: string | null;
  publicCode: string;
}

export type DevelopersShowcaseValue =
  | { kind: "number"; value: string }
  | { kind: "string"; value: string }
  | { kind: "list"; values: string[] };

/** Anchor is a fraction of the card's width and height. */
export interface DevelopersShowcaseField {
  key: string;
  value: DevelopersShowcaseValue;
  anchor: { x: number; y: number };
}

export function developersShowcaseFields(card: DevelopersShowcaseFacts): DevelopersShowcaseField[] {
  const fields: DevelopersShowcaseField[] = [];
  if (card.energy !== null) {
    fields.push({
      key: "energy",
      value: { kind: "number", value: String(card.energy) },
      anchor: { x: 0.11, y: 0.1 },
    });
  }
  if (card.tags.length > 0) {
    fields.push({
      key: "tags",
      value: { kind: "list", values: card.tags },
      anchor: { x: 0.55, y: 0.53 },
    });
  }
  fields.push({
    key: "name",
    value: { kind: "string", value: card.name },
    anchor: { x: 0.24, y: 0.585 },
  });
  if (card.domains.length > 0) {
    fields.push({
      key: "domains",
      value: { kind: "list", values: card.domains },
      anchor: { x: 0.035, y: 0.635 },
    });
  }
  if (card.rulesText) {
    fields.push({
      key: "printedRulesText",
      value: { kind: "string", value: rulesTeaser(card.rulesText, RULES_TEASER_WORDS) },
      anchor: { x: 0.1, y: 0.72 },
    });
  }
  fields.push({
    key: "publicCode",
    value: { kind: "string", value: card.publicCode },
    anchor: { x: 0.1, y: 0.97 },
  });
  return fields;
}
