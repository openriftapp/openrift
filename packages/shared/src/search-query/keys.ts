import type { SearchField } from "../types/search.js";

export type SearchOperator = ":" | "=" | "!=" | "<" | "<=" | ">" | ">=";

export type SearchKeyId =
  | "type"
  | "oracle"
  | "keyword"
  | "domain"
  | "energy"
  | "might"
  | "power"
  | "rarity"
  | "set"
  | "number"
  | "artist"
  | "flavor"
  | "lang"
  | "format"
  | "banned"
  | "usd"
  | "eur"
  | "usdfoil"
  | "eurfoil"
  | "price"
  | "is"
  | "not"
  | "has"
  | "tag"
  | "marker"
  | "channel"
  | "ctag"
  | "owned"
  | "year"
  | "date"
  | "order"
  | "direction"
  | "unique"
  | "in"
  | "prefer";

type SearchKeyKind =
  | "text"
  | "code"
  | "enum"
  | "set"
  | "ordered"
  | "number"
  | "date"
  | "flag"
  | "directive";

export interface SearchKeyDefinition {
  id: SearchKeyId;
  aliases: readonly string[];
  kind: SearchKeyKind;
  field?: SearchField;
}

/** A format's search value is its name ("Constructed" → `constructed`); its id stays an alias. */
export function formatSearchSlug(name: string): string {
  return name
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}]+/gu, "-")
    .replaceAll(/^-|-$/gu, "");
}

const CARD_NUMBER = /^[a-z]{2,4}\d?(?:-[a-z]?\d{1,4}|\d{3})[a-z]?(?:\/\d+)?$/iu;

export function looksLikeCardNumber(word: string): boolean {
  return CARD_NUMBER.test(word);
}

export const IS_VALUES = [
  "foil",
  "metal",
  "metaldeluxe",
  "altart",
  "ultimate",
  "signed",
  "overnumbered",
  "oversized",
  "plain",
  "promo",
  "reprint",
  "firstprint",
  "nonfoil",
  "variant",
] as const;

export type IsValue = (typeof IS_VALUES)[number];

export const IS_ALIASES: Readonly<Record<string, IsValue>> = {
  alternate: "altart",
  alt: "altart",
};

export const HAS_VALUES = ["errata", "image", "marker", "keyword", "tag"] as const;

export const ORDER_VALUES = [
  "name",
  "id",
  "set",
  "released",
  "rarity",
  "energy",
  "power",
  "might",
  "artist",
  "usd",
  "eur",
  "price",
] as const;

export type SearchOrder = (typeof ORDER_VALUES)[number];

export const PREFER_VALUES = ["oldest", "newest", "usd-low", "eur-low"] as const;

export type PreferValue = (typeof PREFER_VALUES)[number];

export const DIRECTION_VALUES = ["asc", "desc", "auto"] as const;

export function resolveDirection(
  order: SearchOrder,
  direction?: (typeof DIRECTION_VALUES)[number],
): "asc" | "desc" {
  if (direction === "asc" || direction === "desc") {
    return direction;
  }
  return order === "usd" || order === "eur" || order === "price" || order === "released"
    ? "desc"
    : "asc";
}

export const UNIQUE_VALUES = ["cards", "prints", "art"] as const;

export const SEARCH_KEYS: readonly SearchKeyDefinition[] = [
  { id: "type", aliases: ["t", "type"], kind: "text", field: "type" },
  { id: "oracle", aliases: ["o", "oracle"], kind: "text", field: "cardText" },
  { id: "keyword", aliases: ["kw", "keyword"], kind: "text", field: "keywords" },
  { id: "domain", aliases: ["d", "domain"], kind: "set" },
  { id: "energy", aliases: ["e", "energy"], kind: "number" },
  { id: "might", aliases: ["m", "might"], kind: "number" },
  { id: "power", aliases: ["p", "power", "pow"], kind: "number" },
  { id: "rarity", aliases: ["r", "rarity"], kind: "ordered" },
  { id: "set", aliases: ["s", "set"], kind: "enum" },
  { id: "number", aliases: ["cn", "number"], kind: "code", field: "id" },
  { id: "artist", aliases: ["a", "artist"], kind: "text", field: "artist" },
  { id: "flavor", aliases: ["ft", "flavor"], kind: "text", field: "flavorText" },
  { id: "lang", aliases: ["lang"], kind: "enum" },
  { id: "format", aliases: ["f", "format", "legal"], kind: "flag" },
  { id: "banned", aliases: ["banned"], kind: "flag" },
  { id: "usd", aliases: ["usd"], kind: "number" },
  { id: "eur", aliases: ["eur"], kind: "number" },
  { id: "usdfoil", aliases: ["usdfoil"], kind: "number" },
  { id: "eurfoil", aliases: ["eurfoil"], kind: "number" },
  { id: "price", aliases: ["price"], kind: "number" },
  { id: "is", aliases: ["is"], kind: "flag" },
  { id: "not", aliases: ["not"], kind: "flag" },
  { id: "has", aliases: ["has"], kind: "flag" },
  { id: "tag", aliases: ["tag"], kind: "text", field: "tags" },
  { id: "marker", aliases: ["marker"], kind: "enum" },
  { id: "channel", aliases: ["channel"], kind: "enum" },
  { id: "ctag", aliases: ["ctag"], kind: "enum" },
  { id: "owned", aliases: ["owned"], kind: "number" },
  { id: "year", aliases: ["year"], kind: "number" },
  { id: "date", aliases: ["date"], kind: "date" },
  { id: "order", aliases: ["order"], kind: "directive" },
  { id: "direction", aliases: ["direction"], kind: "directive" },
  { id: "unique", aliases: ["unique"], kind: "directive" },
  { id: "in", aliases: ["in"], kind: "enum" },
  { id: "prefer", aliases: ["prefer"], kind: "directive" },
];

export const FOREIGN_KEY_HINTS: Readonly<Record<string, string>> = {
  cost: "e",
  mv: "e",
  cmc: "e",
  manavalue: "e",
  text: "o",
  num: "cn",
  c: "d",
  color: "d",
  identity: "d",
};

const KEY_BY_ALIAS = new Map(
  SEARCH_KEYS.flatMap((definition) => definition.aliases.map((alias) => [alias, definition])),
);

const KEY_BY_ID = new Map(SEARCH_KEYS.map((definition) => [definition.id, definition]));

export function searchKeyByAlias(alias: string): SearchKeyDefinition | undefined {
  return KEY_BY_ALIAS.get(alias.toLowerCase());
}

export function searchKey(id: SearchKeyId): SearchKeyDefinition {
  return KEY_BY_ID.get(id) as SearchKeyDefinition;
}

export function operatorsFor(kind: SearchKeyKind): readonly SearchOperator[] {
  switch (kind) {
    case "text":
    case "enum": {
      return [":", "=", "!="];
    }
    case "code":
    case "set":
    case "ordered":
    case "number":
    case "date": {
      return [":", "=", "!=", "<", "<=", ">", ">="];
    }
    case "flag":
    case "directive": {
      return [":", "="];
    }
  }
}
