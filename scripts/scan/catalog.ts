/* oxlint-disable import/no-nodejs-modules -- standalone CLI tooling, never bundled */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { referenceSignature } from "../../packages/shared/src/scan/aligned-verify.js";
import type { IllustrationSample } from "../../packages/shared/src/scan/art-groups.js";
import {
  SHARED_ILLUSTRATION_MIN_SCORE,
  groupArtworks,
  groupSharedIllustrations,
  illustrationCardKey,
} from "../../packages/shared/src/scan/art-groups.js";
import type { EmbedBank } from "../../packages/shared/src/scan/embed.js";
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

const QUERY = `
  select pi.image_file_id as key,
         c.name as name,
         s.slug as set_slug,
         p.public_code as public_code,
         p.language as language,
         c.type as card_type,
         p.art_variant as art_variant,
         p.is_overnumbered as is_overnumbered,
         array_to_string(p.marker_slugs, '+') as markers
  from printing_images pi
  join printings p on p.id = pi.printing_id
  join cards c on c.id = p.card_id
  join sets s on s.id = p.set_id
  where pi.face = 'front'
`;

export function loadCatalog(refresh = false): Map<string, CardIdentity> {
  if (!refresh && fs.existsSync(CACHE_FILE)) {
    const cached = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8")) as CardIdentity[];
    // A cache written before cardType, markers or the overnumbered segment of
    // artKey existed refreshes itself once (checked by field count, not value).
    const first = cached[0];
    const fresh =
      first === undefined ||
      (first.cardType !== undefined && "markers" in first && first.artKey.split("|").length === 4);
    if (fresh) {
      return new Map(cached.map((c) => [c.key, c]));
    }
  }

  const raw = execFileSync(
    "docker",
    ["exec", "openrift-db-1", "psql", "-U", "openrift", "-t", "-A", "-F", "", "-c", QUERY],
    { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 },
  );

  const identities: CardIdentity[] = [];
  const byKey = new Map<string, CardIdentity>();
  for (const line of raw.split("\n")) {
    const parts = line.split("");
    if (parts.length < 9) {
      continue;
    }
    const [
      key,
      name,
      setSlug,
      publicCode,
      language,
      cardType,
      artVariant,
      isOvernumbered,
      markers,
    ] = parts;
    const existing = byKey.get(key);
    if (existing) {
      // One image can serve several printings: the first row stays the identity,
      // and a marker disagreement voids the image's marker set.
      if (existing.markers !== markers) {
        existing.markers = null;
      }
      continue;
    }
    const identity: CardIdentity = {
      key,
      name,
      setSlug,
      publicCode,
      language,
      cardType,
      markers,
      // Language is left out on purpose. An overnumbered print keys apart, as in
      // the server's scanArtKey.
      artKey: `${setSlug}|${name}|${artVariant}|${isOvernumbered === "t" ? "over" : ""}`,
    };
    byKey.set(key, identity);
    identities.push(identity);
  }

  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, `${JSON.stringify(identities, null, 2)}\n`);
  return new Map(identities.map((c) => [c.key, c]));
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
  return identity
    ? `${identity.name} [${identity.publicCode} ${identity.language}]`
    : `unknown:${key.slice(0, 8)}`;
}
