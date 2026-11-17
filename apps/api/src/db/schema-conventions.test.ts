import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const SCHEMA = readFileSync(new URL("../../../../docs/schema.sql", import.meta.url), "utf-8");

const BOOLEAN_PREFIXES = ["is_", "has_", "can_", "needs_", "allow_"];

const BOOLEAN_EXEMPT = new Set([
  // better-auth owns these column names.
  "api_keys.enabled",
  "api_keys.rate_limit_enabled",
  "users.email_verified",
  // `rankIsTier` is a stored `claimed_fields` value that doubles as the column key.
  "meta_event_players.rank_is_tier",
  "meta_event_player_overlays.rank_is_tier",
]);

const CONSTRAINT_PREFIX: Record<string, string> = {
  "PRIMARY KEY": "pk_",
  "FOREIGN KEY": "fk_",
  UNIQUE: "uq_",
  CHECK: "chk_",
};

function tables(): { table: string; columns: { name: string; type: string }[] }[] {
  return [
    ...SCHEMA.matchAll(/^CREATE TABLE public\.(?<table>\w+) \(\n(?<body>[\s\S]*?)\n\);/gmu),
  ].map((match) => ({
    table: match.groups!.table!,
    columns: match
      .groups!.body!.split("\n")
      .map((line) => /^ {4}(?<name>\w+) (?<type>[a-z][\w ]*?)(?:[,( ]|$)/u.exec(line)?.groups)
      .filter((groups) => groups !== undefined && groups.name !== "CONSTRAINT")
      .map((groups) => ({ name: groups!.name!, type: groups!.type! })),
  }));
}

describe("schema naming conventions", () => {
  it("names constraints pk_, fk_, uq_ and chk_", () => {
    const offenders = [
      ...SCHEMA.matchAll(/CONSTRAINT (?<name>\w+) (?<kind>PRIMARY KEY|FOREIGN KEY|UNIQUE|CHECK)/gu),
    ]
      .map((match) => ({ name: match.groups!.name!, kind: match.groups!.kind! }))
      .filter(({ name, kind }) => !name.startsWith(CONSTRAINT_PREFIX[kind]!))
      .map(({ name }) => name)
      .filter((name) => !name.startsWith("kysely_migration"));

    expect(offenders).toEqual([]);
  });

  it("names indexes idx_, and unique indexes uq_", () => {
    const offenders = [...SCHEMA.matchAll(/^CREATE (?<unique>UNIQUE )?INDEX (?<name>\w+) /gmu)]
      .map((match) => ({ name: match.groups!.name!, unique: match.groups!.unique !== undefined }))
      .filter(({ name, unique }) => !name.startsWith(unique ? "uq_" : "idx_"))
      .map(({ name }) => name);

    expect(offenders).toEqual([]);
  });

  it("names triggers trg_", () => {
    const offenders = [...SCHEMA.matchAll(/^CREATE (?:CONSTRAINT )?TRIGGER (?<name>\w+) /gmu)]
      .map((match) => match.groups!.name!)
      .filter((name) => !name.startsWith("trg_"));

    expect(offenders).toEqual([]);
  });

  it("prefixes boolean columns with a predicate word", () => {
    const offenders = tables().flatMap(({ table, columns }) =>
      columns
        .filter((column) => column.type === "boolean")
        .filter((column) => !BOOLEAN_PREFIXES.some((prefix) => column.name.startsWith(prefix)))
        .map((column) => `${table}.${column.name}`)
        .filter((column) => !BOOLEAN_EXEMPT.has(column)),
    );

    expect(offenders).toEqual([]);
  });

  it("names ordering columns sort_order", () => {
    const offenders = tables().flatMap(({ table, columns }) =>
      columns
        .filter((column) => ["position", "ordinal", "sort", "order_index"].includes(column.name))
        .map((column) => `${table}.${column.name}`),
    );

    expect(offenders).toEqual([]);
  });

  it("parses the snapshot", () => {
    const parsed = tables();
    expect(parsed.length).toBeGreaterThan(100);
    expect(
      parsed.find(({ table }) => table === "cards")?.columns.map(({ name }) => name),
    ).toContain("slug");
  });
});
