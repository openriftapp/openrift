import { enumLabel } from "./enum-label.js";
import type { LabelMap } from "./enum-label.js";

export interface CardStatFields {
  readonly superTypes: readonly string[];
  readonly types: readonly string[];
  readonly domains: readonly string[];
  readonly energy: number | null;
  readonly might: number | null;
  readonly power: number | null;
}

export interface CardStatLabels {
  readonly superTypes: LabelMap;
  readonly cardTypes: LabelMap;
  readonly domains: LabelMap;
}

export function describeCardStats(card: CardStatFields, labels: CardStatLabels): string {
  const typeLine = [
    ...card.superTypes.map((slug) => enumLabel(labels.superTypes, slug)),
    ...card.types.map((slug) => enumLabel(labels.cardTypes, slug)),
  ]
    .filter((label) => label !== "")
    .join(" ");
  const domainLine = card.domains
    .map((slug) => enumLabel(labels.domains, slug))
    .filter((label) => label !== "")
    .join(" / ");
  const parts = [typeLine, domainLine].filter((part) => part !== "");
  if (card.energy !== null) {
    parts.push(`Energy ${card.energy}`);
  }
  if (card.might !== null) {
    parts.push(`Might ${card.might}`);
  }
  if (card.power !== null) {
    parts.push(`Power ${card.power}`);
  }
  return parts.filter(Boolean).join(" · ");
}
