/* oxlint-disable import/no-nodejs-modules -- standalone CLI tooling, never bundled */
/** The catalogue's printings in the shape the web app's `resolveLock` reads. */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { Printing } from "../../packages/shared/src/types/catalog.js";
import { CACHE_DIR } from "./lib";

const CACHE_FILE = path.join(CACHE_DIR, "printings.json");

const QUERY = `
  select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
    select p.id, p.card_id as "cardId", p.short_code as "shortCode", s.slug as "setSlug",
           p.art_variant as "artVariant", p.is_signed as "isSigned",
           p.is_overnumbered as "isOvernumbered", p.marker_slugs as "markerSlugs",
           p.finish, p.size, p.language, p.public_code as "publicCode",
           p.canonical_rank as "canonicalRank",
           coalesce((select json_agg(pi.image_file_id) from printing_images pi
                     where pi.printing_id = p.id and pi.face = 'front'), '[]'::json) as "imageIds"
    from printings_ordered p
    join sets s on s.id = p.set_id
  ) t
`;

interface PrintingRow {
  id: string;
  cardId: string;
  shortCode: string;
  setSlug: string;
  artVariant: string;
  isSigned: boolean;
  isOvernumbered: boolean;
  markerSlugs: string[];
  finish: string;
  size: string;
  language: string;
  publicCode: string;
  canonicalRank: number;
  imageIds: string[];
}

export function loadPrintings(refresh = false): Printing[] {
  let rows: PrintingRow[];
  if (!refresh && fs.existsSync(CACHE_FILE)) {
    rows = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8")) as PrintingRow[];
  } else {
    const raw = execFileSync(
      "docker",
      ["exec", "openrift-db-1", "psql", "-U", "openrift", "-t", "-A", "-c", QUERY],
      { encoding: "utf-8", maxBuffer: 256 * 1024 * 1024 },
    );
    rows = JSON.parse(raw) as PrintingRow[];
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(rows));
  }
  // Only the fields resolveLock and sortForPicker read are filled in.
  return rows.map(
    (row) =>
      ({
        id: row.id,
        cardId: row.cardId,
        shortCode: row.shortCode,
        setSlug: row.setSlug,
        artVariant: row.artVariant,
        isSigned: row.isSigned,
        isOvernumbered: row.isOvernumbered,
        markers: row.markerSlugs.map((slug) => ({ slug })),
        finish: row.finish,
        size: row.size,
        language: row.language,
        publicCode: row.publicCode,
        canonicalRank: row.canonicalRank,
        images: row.imageIds.map((imageId) => ({ imageId })),
      }) as unknown as Printing,
  );
}
