import type { CardmarketPicksResolution } from "@openrift/shared/contracts/cardmarket-picks";
import { CARDMARKET_PICKS_MAX_ROWS } from "@openrift/shared/contracts/cardmarket-picks";
import type { Printing } from "@openrift/shared/types/catalog";
import { WellKnown } from "@openrift/shared/well-known";
import { z } from "zod";

import type { MatchedEntry } from "@/features/collections/lib/import-matcher";

const HASH_PARAM = "picks";

/** Mirrors `PicksPayload` in the extension; the `v` literal is the contract between them. */
const payloadSchema = z.object({
  v: z.literal(1),
  seller: z.string().trim().min(1).max(100),
  picks: z
    .array(
      z.object({
        idProduct: z.number().int().positive(),
        finish: z.enum(["normal", "foil"]),
        idLanguage: z.number().int().nonnegative().nullable(),
        languageLabel: z.string().max(100).nullable(),
        productName: z.string().trim().min(1).max(300),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(CARDMARKET_PICKS_MAX_ROWS),
});

export type CardmarketPicksPayload = z.infer<typeof payloadSchema>;
export type CardmarketPickInput = CardmarketPicksPayload["picks"][number];

export function parsePicksHash(hash: string): CardmarketPicksPayload | undefined {
  const raw = new URLSearchParams(hash.replace(/^#/u, "")).get(HASH_PARAM);
  if (raw === null) {
    return undefined;
  }
  try {
    const result = payloadSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

export function picksToResolveRows(payload: CardmarketPicksPayload) {
  return payload.picks.map((pick) => ({
    idProduct: pick.idProduct,
    isFoil: pick.finish === "foil",
    idLanguage: pick.idLanguage ?? 0,
  }));
}

const REASON_TEXT: Record<
  NonNullable<CardmarketPicksResolution["rows"][number]["reason"]>,
  string
> = {
  "unknown-condition": "Cardmarket article has no readable condition",
  "language-not-printed": "Riftbound is not printed in this language",
  "unknown-product": "OpenRift does not know this Cardmarket product",
  "unmapped-product": "This Cardmarket product is not linked to a printing yet",
  "no-printing-in-language": "No printing of this card exists in this language",
  "ambiguous-printing": "Several printings sit behind this product",
};

function rawFields(
  pick: CardmarketPickInput,
  seller: string,
  row: CardmarketPicksResolution["rows"][number] | undefined,
): Record<string, string> {
  const fields: Record<string, string> = {
    Seller: seller,
    Product: pick.productName,
    Language: pick.languageLabel ?? "unknown",
  };
  if (pick.finish === "foil") {
    fields.Finish = "Foil";
  }
  if (row?.reason) {
    fields.Problem = REASON_TEXT[row.reason];
  }
  return fields;
}

/** One entry per pick, in pick order; a pick the server could not place arrives unresolved. */
export function matchedEntriesFromPicks(
  payload: CardmarketPicksPayload,
  resolution: CardmarketPicksResolution | undefined,
  printingsById: Record<string, Printing>,
): MatchedEntry[] {
  return payload.picks.map((pick, index) => {
    const row = resolution?.rows[index];
    const printing = row?.printingId ? printingsById[row.printingId] : undefined;
    return {
      entry: {
        setPrefix: "",
        finish: pick.finish === "foil" ? WellKnown.finish.FOIL : WellKnown.finish.NORMAL,
        artVariant: WellKnown.artVariant.NORMAL,
        quantity: pick.quantity,
        cardName: row?.productName ?? pick.productName,
        sourceCode: "",
        rawFields: rawFields(pick, payload.seller, row),
      },
      status: printing === undefined ? "unresolved" : "exact",
      resolvedPrinting: printing ?? null,
      candidates: printing === undefined ? [] : [printing],
    };
  });
}

export function defaultPicksListName(seller: string): string {
  return `Cardmarket · ${seller}`;
}
