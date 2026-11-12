import { readdirSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

const contractFiles = readdirSync(import.meta.dirname, {
  recursive: true,
  encoding: "utf-8",
}).filter(
  (file) =>
    file.endsWith(".ts") &&
    !file.endsWith(".test.ts") &&
    file !== "index.ts" &&
    !file.startsWith("admin/"),
);

const FORBIDDEN_KEYS = new Set(["originalUrl", "rehostedUrl", "imageUrl"]);
const URL_KEY = /url$|^(?:image|imageSrc|src)$/iu;

const ALLOWED_URL_KEYS = new Set([
  "card-trades.ts:image",
  "loans.ts:image",
  "public-pod-tournaments.ts:image",
  "tournaments.ts:image",
  "card-submissions.ts:url",
  "card-trades.ts:url",
  "cards.ts:sourceUrl",
  "catalog.ts:sourceUrl",
  "collections.ts:url",
  "copies.ts:url",
  "deck-check-ingest.ts:claimUrl",
  "decks.ts:url",
  "errata.ts:sourceUrl",
  "errata.ts:url",
  "friend-groups.ts:bannerUrl",
  "friend-groups.ts:url",
  "meta.ts:sourceUrl",
  "meta.ts:url",
  "overlay.ts:qrUrl",
  "prices.ts:url",
  "products.ts:sourceUrl",
  "promos.ts:sourceUrl",
  "public-collections.ts:url",
  "public-decks.ts:sourceUrl",
  "public-decks.ts:url",
  "public-overlay.ts:qrUrl",
  "scan.ts:bankUrl",
  "scan.ts:boardDetectorUrl",
  "scan.ts:detectorUrl",
  "scan.ts:encoderUrl",
  "scan.ts:labelsUrl",
  "search.ts:sourceUrl",
  "sets.ts:sourceUrl",
  "stage-presets.ts:qrUrl",
]);

interface Procedure {
  "~orpc": { outputSchema?: z.ZodType };
}

function isProcedure(value: unknown): value is Procedure {
  return typeof value === "object" && value !== null && "~orpc" in value;
}

function outputSchemas(router: unknown): z.ZodType[] {
  if (isProcedure(router)) {
    const schema = router["~orpc"].outputSchema;
    return schema === undefined ? [] : [schema];
  }
  if (typeof router !== "object" || router === null) {
    return [];
  }
  return Object.values(router).flatMap((child) => outputSchemas(child));
}

function propertyKeys(node: unknown, keys: Set<string>): Set<string> {
  if (Array.isArray(node)) {
    for (const item of node) {
      propertyKeys(item, keys);
    }
    return keys;
  }
  if (typeof node !== "object" || node === null) {
    return keys;
  }
  const record = node as Record<string, unknown>;
  const properties = record.properties;
  if (typeof properties === "object" && properties !== null) {
    for (const key of Object.keys(properties)) {
      keys.add(key);
    }
  }
  for (const value of Object.values(record)) {
    propertyKeys(value, keys);
  }
  return keys;
}

async function urlKeysByFile(): Promise<string[]> {
  const found = new Set<string>();
  for (const file of contractFiles) {
    const mod: Record<string, unknown> = await import(`./${file}`);
    for (const [name, value] of Object.entries(mod)) {
      if (!name.endsWith("Contract")) {
        continue;
      }
      for (const schema of outputSchemas(value)) {
        const json = z.toJSONSchema(schema, { unrepresentable: "any", io: "output" });
        for (const key of propertyKeys(json, new Set())) {
          if (FORBIDDEN_KEYS.has(key) || URL_KEY.test(key)) {
            found.add(`${file}:${key}`);
          }
        }
      }
    }
  }
  return [...found].toSorted();
}

describe("public oRPC contract outputs (plain Hono routes have no contract and are not covered)", () => {
  let keys: string[] = [];

  beforeAll(async () => {
    keys = await urlKeysByFile();
  }, 60_000);

  it("carry no image URL and only the allowlisted URL fields", () => {
    const offenders = keys.filter((entry) => {
      const key = entry.slice(entry.indexOf(":") + 1);
      return FORBIDDEN_KEYS.has(key) || !ALLOWED_URL_KEYS.has(entry);
    });

    expect(offenders).toEqual([]);
  });

  it("keeps no allowlist entry that no output still uses", () => {
    const found = new Set(keys);

    expect([...ALLOWED_URL_KEYS].filter((entry) => !found.has(entry))).toEqual([]);
  });
});
