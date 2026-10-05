/* oxlint-disable import/no-nodejs-modules -- standalone CLI tooling, never bundled */
/**
 * Replays the bank build's shared-illustration grouping on the dev catalogue
 * and prints every cross-artKey pair of one card with its score. Run under
 * Node (Bun+sharp corrupts webp decodes): `node <jiti-cli> scripts/scan/illustration-groups.ts`.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import sharp from "sharp";

import type { AlignedSignature } from "../../packages/shared/src/scan/aligned-verify";
import { referenceSignature } from "../../packages/shared/src/scan/aligned-verify";
import {
  illustrationCardKey,
  illustrationScore,
  SHARED_ILLUSTRATION_MIN_SCORE,
} from "../../packages/shared/src/scan/art-groups";
import type { RgbaImage } from "../../packages/shared/src/scan/types";

const MEDIA_CARDS = path.resolve(process.cwd(), "media/cards");

const QUERY = `
select coalesce(json_agg(r), '[]') from (
  select distinct on (ci.id) ci.id::text as "imageId", c.name, s.slug as "setSlug",
         p.public_code as "publicCode", p.language, c.type as "cardType",
         p.art_variant as "artVariant", p.is_overnumbered as "isOvernumbered", p.artist
  from printing_images pi
  join image_files ci on ci.id = pi.image_file_id
  join printings p on p.id = pi.printing_id
  join cards c on c.id = p.card_id
  join sets s on s.id = p.set_id
  where pi.face = 'front' and pi.is_active and ci.rehosted_url is not null
  order by ci.id, p.id
) r`;

interface Row {
  imageId: string;
  name: string;
  setSlug: string;
  publicCode: string;
  language: string;
  cardType: string;
  artVariant: string;
  isOvernumbered: boolean;
  artist: string;
}

async function decode(file: string): Promise<RgbaImage> {
  const { data, info } = await sharp(file)
    .flatten({ background: { r: 128, g: 128, b: 128 } })
    .raw()
    .toColourspace("srgb")
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });
  return {
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
    width: info.width,
    height: info.height,
  };
}

const rows = JSON.parse(
  execFileSync("docker", ["exec", "openrift-db-1", "psql", "-U", "openrift", "-At", "-c", QUERY], {
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  }),
) as Row[];

const artKeyOf = (row: Row) =>
  `${row.setSlug}|${row.name}|${row.artVariant}|${row.isOvernumbered ? "over" : ""}`;
const byCard = Map.groupBy(rows, (row) => illustrationCardKey(row.name, row.cardType));

const signatures = new Map<string, AlignedSignature>();
for (const cardRows of byCard.values()) {
  if (new Set(cardRows.map((row) => artKeyOf(row))).size < 2) {
    continue;
  }
  for (const row of cardRows) {
    const file = path.join(MEDIA_CARDS, row.imageId.slice(-2), `${row.imageId}-400w.webp`);
    if (fs.existsSync(file)) {
      signatures.set(row.imageId, referenceSignature(await decode(file)));
    }
  }
}

interface PairResult {
  card: string;
  type: string;
  a: string;
  b: string;
  sameArtist: boolean;
  artists: string;
  best: number;
  codes: string;
}

const pairs: PairResult[] = [];
for (const [card, cardRows] of byCard) {
  const byArt = Map.groupBy(
    cardRows.filter((row) => signatures.has(row.imageId)),
    artKeyOf,
  );
  const artKeys = [...byArt.keys()].toSorted();
  for (let i = 0; i < artKeys.length; i++) {
    for (let j = i + 1; j < artKeys.length; j++) {
      const rowsA = byArt.get(artKeys[i] as string) ?? [];
      const rowsB = byArt.get(artKeys[j] as string) ?? [];
      let best = Number.NEGATIVE_INFINITY;
      let codes = "";
      for (const a of rowsA) {
        for (const b of rowsB) {
          const score = illustrationScore(
            signatures.get(a.imageId) as AlignedSignature,
            signatures.get(b.imageId) as AlignedSignature,
          );
          if (score > best) {
            best = score;
            codes = `${a.publicCode} ${a.language} / ${b.publicCode} ${b.language}`;
          }
        }
      }
      const artistsA = new Set(rowsA.map((row) => row.artist));
      const artistsB = new Set(rowsB.map((row) => row.artist));
      pairs.push({
        card,
        type: rowsA[0]?.cardType ?? "",
        a: artKeys[i] as string,
        b: artKeys[j] as string,
        sameArtist: [...artistsA].some((artist) => artistsB.has(artist)),
        artists: `${[...artistsA].join("+")} / ${[...artistsB].join("+")}`,
        best,
        codes,
      });
    }
  }
}

pairs.sort((x, y) => y.best - x.best);
const out = process.argv[2];
if (out) {
  fs.writeFileSync(out, `${JSON.stringify(pairs, null, 1)}\n`);
}
const merged = pairs.filter((pair) => pair.best >= SHARED_ILLUSTRATION_MIN_SCORE);
console.log(
  `${pairs.length} cross-artKey pairs, ${merged.length} at or above ${SHARED_ILLUSTRATION_MIN_SCORE}`,
);
for (const pair of pairs.slice(0, 80)) {
  console.log(
    `${pair.best.toFixed(3)} ${pair.sameArtist ? "same" : "DIFF"} ${pair.type.padEnd(11)} ${pair.a} ~ ${pair.b} [${pair.codes}] (${pair.artists})`,
  );
}
