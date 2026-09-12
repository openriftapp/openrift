import type { CardmarketPicksResolution } from "@openrift/shared/contracts/cardmarket-picks";
import { CARDMARKET_PICKS_MAX_ROWS } from "@openrift/shared/contracts/cardmarket-picks";
import type { Printing } from "@openrift/shared/types/catalog";
import { WellKnown } from "@openrift/shared/well-known";
import { z } from "zod";

import type { MatchedEntry } from "@/features/collections/lib/import-matcher";
import { m } from "@/paraglide/messages.js";

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
type CardmarketPickInput = CardmarketPicksPayload["picks"][number];

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

type PickReason = NonNullable<CardmarketPicksResolution["rows"][number]["reason"]>;

function reasonText(reason: PickReason): string {
  const texts: Record<PickReason, string> = {
    "unknown-condition": m.extension_picks_reason_unknown_condition(),
    "language-not-printed": m.extension_picks_reason_language_not_printed(),
    "unknown-product": m.extension_picks_reason_unknown_product(),
    "unmapped-product": m.extension_picks_reason_unmapped_product(),
    "no-printing-in-language": m.extension_picks_reason_no_printing_in_language(),
    "ambiguous-printing": m.extension_picks_reason_ambiguous_printing(),
  };
  return texts[reason];
}

function rawFields(
  pick: CardmarketPickInput,
  seller: string,
  row: CardmarketPicksResolution["rows"][number] | undefined,
): Record<string, string> {
  const fields: Record<string, string> = {
    [m.extension_picks_field_seller()]: seller,
    [m.extension_picks_field_product()]: pick.productName,
    [m.extension_picks_field_language()]:
      pick.languageLabel ?? m.extension_picks_language_unknown(),
  };
  if (pick.finish === "foil") {
    fields[m.extension_picks_field_finish()] = m.extension_picks_finish_foil();
  }
  if (row?.reason) {
    fields[m.extension_picks_field_problem()] = reasonText(row.reason);
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
