import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { BACKGROUND_POOL, createDb } from "../../apps/api/src/db/connect.js";
import type { ScanReferenceRow } from "../../apps/api/src/modules/catalog/repositories/catalog-printings.js";
import { catalogPrintingsRepo } from "../../apps/api/src/modules/catalog/repositories/catalog-printings.js";
import { referenceSignature } from "../../packages/shared/src/scan/aligned-verify.js";
import type { IllustrationSample } from "../../packages/shared/src/scan/art-groups.js";
import {
  SHARED_ILLUSTRATION_MIN_SCORE,
  groupArtworks,
  groupSharedIllustrations,
  illustrationCardKey,
  scanArtKey,
} from "../../packages/shared/src/scan/art-groups.js";
import type { EmbedBank } from "../../packages/shared/src/scan/embed.js";
import { describeScanKey } from "../../packages/shared/src/scan/labels.js";
import { isLocalDatabase, requireEnv } from "../env.js";
import { nodeEmbedder } from "./embed-bank";
import { CACHE_DIR, DATA_DIR, listReferenceImages, loadImage } from "./lib";

export interface CardIdentity {
  key: string;
  name: string;
  setSlug: string;
  publicCode: string;
  language: string;
  cardType: string;
  /** "promo", "judge+promo", "" for none; null when printings sharing this image disagree on markers. */
  markers: string | null;
  artKey: string;
}

const CACHE_FILE = path.join(DATA_DIR, "cache", "catalog.json");
const ILLUSTRATION_SIGNATURE_VERSION = "aligned-v1";

export async function loadCatalog(): Promise<Map<string, CardIdentity>> {
  const databaseUrl = requireEnv("DATABASE_URL");
  if (!isLocalDatabase(databaseUrl)) {
    throw new Error("the scan bench reads the local dev database only");
  }
  const { db } = createDb(databaseUrl, BACKGROUND_POOL);
  let rows: ScanReferenceRow[];
  try {
    rows = await catalogPrintingsRepo(db).scanReferences();
  } finally {
    await db.destroy();
  }
  const identities = rows.map((row): CardIdentity => ({
    key: row.imageId,
    name: row.name,
    setSlug: row.setSlug,
    publicCode: row.publicCode,
    language: row.language,
    cardType: row.cardType,
    markers: row.markersMin === row.markersMax ? row.markersMin : null,
    artKey: scanArtKey(row),
  }));
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, `${JSON.stringify(identities, null, 2)}\n`);
  return new Map(identities.map((identity) => [identity.key, identity]));
}

/**
 * Applies the server's bank grouping: rewrites each identity's artKey to its
 * group and returns the catalogue-artKey-to-group map.
 */
export async function applyArtGroups(
  catalog: Map<string, CardIdentity>,
  bank: EmbedBank,
  sharedIllustrations = true,
): Promise<Map<string, string>> {
  const illustrations = sharedIllustrations
    ? await illustrationGroups(catalog, bank)
    : new Map<string, string>();
  const artKeys = new Map(
    bank.keys.flatMap((key) => {
      const identity = catalog.get(key);
      return identity ? [[key, identity.artKey] as const] : [];
    }),
  );
  const { groupOf } = groupArtworks(
    bank,
    artKeys,
    (key) => {
      const identity = catalog.get(key);
      return identity && { name: identity.name, type: identity.cardType };
    },
    illustrations,
  );
  for (const identity of catalog.values()) {
    identity.artKey = groupOf.get(identity.artKey) ?? identity.artKey;
  }
  return groupOf;
}

async function illustrationGroups(
  catalog: Map<string, CardIdentity>,
  bank: EmbedBank,
): Promise<Map<string, string>> {
  const digest = createHash("sha256")
    .update(bank.keys.join(","))
    .update(`|${SHARED_ILLUSTRATION_MIN_SCORE}|${ILLUSTRATION_SIGNATURE_VERSION}`)
    .digest("hex")
    .slice(0, 12);
  const cacheFile = path.join(CACHE_DIR, `illustration-groups-${digest}.json`);
  if (fs.existsSync(cacheFile)) {
    return new Map(JSON.parse(fs.readFileSync(cacheFile, "utf-8")) as [string, string][]);
  }
  const files = new Map(listReferenceImages().map((entry) => [entry.key, entry.file]));
  const samples: IllustrationSample[] = [];
  for (const key of bank.keys) {
    const identity = catalog.get(key);
    const file = files.get(key);
    if (!identity || !file) {
      continue;
    }
    const image = await loadImage(file);
    samples.push({
      artKey: identity.artKey,
      card: illustrationCardKey(identity.name, identity.cardType),
      signature: referenceSignature(image),
    });
  }
  const groups = groupSharedIllustrations(samples);
  fs.writeFileSync(cacheFile, JSON.stringify([...groups]));
  return groups;
}

export function describe(catalog: Map<string, CardIdentity>, key: string | null): string {
  if (!key) {
    return "none";
  }
  const identity = catalog.get(key);
  return describeScanKey(identity && { ...identity, code: identity.publicCode }, key);
}

export function benchDeps(
  catalog: Map<string, CardIdentity>,
  bank: EmbedBank,
  referenceFiles: ReadonlyMap<string, string>,
  embedImageSize: number,
) {
  return {
    embedder: nodeEmbedder,
    bank,
    embedImageSize,
    artKeyOf: (key: string) => catalog.get(key)?.artKey ?? key,
    labelOf: (key: string) => describe(catalog, key),
    identityOf: (key: string) => {
      const identity = catalog.get(key);
      return (
        identity && {
          type: identity.cardType,
          code: identity.publicCode,
          markers: identity.markers ?? undefined,
          language: identity.language,
        }
      );
    },
    fetchReference: async (key: string) => {
      const file = referenceFiles.get(key);
      return file ? await loadImage(file) : null;
    },
  };
}
