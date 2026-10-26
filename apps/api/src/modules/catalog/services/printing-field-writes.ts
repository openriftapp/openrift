import type { AcceptPrintingField } from "@openrift/shared/contracts/admin/card-mutations";
import { printingFieldRules } from "@openrift/shared/db-field-rules";
import { ERROR_CODES } from "@openrift/shared/error-codes";
import { normalizeProvidedPrintingValue } from "@openrift/shared/printing-value-normalize";
import type { ReleasePrecision, SetRelease } from "@openrift/shared/set-release";
import { normalizeToPeriodStart, parseReleaseInput } from "@openrift/shared/set-release";
import { z } from "zod";

import type { Repos, Transact } from "../../../deps.js";
import { AppError } from "../../../errors.js";
import { assertFound } from "../../../lib/assertions.js";
import { asFieldWriteError, validateFieldValue } from "../lib/field-values.js";
import { updatePrintingDistributionChannels, updatePrintingMarkers } from "./printing-admin.js";

export type PrintingFieldSource = "provider" | "manual";

type NormalizeRepos = Pick<Repos, "catalogMutations" | "rarities" | "keywords">;
type WriteRepos = Pick<
  Repos,
  "catalogMutations" | "cardTokens" | "catalog" | "distributionChannels" | "keywords" | "sets"
>;

const TYPOGRAPHY_TEXT_FIELDS = new Set(["printedRulesText", "printedEffectText"]);

// The inputs of `mv_printing_foil_twins` and `mv_printing_sides_canonical_rank`.
const CATALOG_VIEW_FIELDS: ReadonlySet<AcceptPrintingField> = new Set([
  "shortCode",
  "setId",
  "artVariant",
  "isSigned",
  "isOvernumbered",
  "markerSlugs",
  "finish",
  "size",
  "language",
]);

export function changesCatalogViews(field: AcceptPrintingField): boolean {
  return CATALOG_VIEW_FIELDS.has(field);
}

interface ReleaseWrite {
  releasedAt: string | null;
  releasePrecision: ReleasePrecision | null;
}

const releasePairSchema = z.object({
  releasedAt: z.string().nullable(),
  releasePrecision: printingFieldRules.releasePrecision,
});

function invalidRelease(message: string): AppError {
  return new AppError(400, ERROR_CODES.VALIDATION_ERROR, message);
}

/** A bare date keeps the printing's precision. Both columns are written together because
 * of their pair CHECK. */
async function normalizeReleaseValue(
  repos: NormalizeRepos,
  printingId: string,
  field: "releasedAt" | "releasePrecision",
  value: unknown,
): Promise<ReleaseWrite> {
  const before = await repos.catalogMutations.getFullPrintingById(printingId);
  assertFound(before, "Printing not found");

  if (field === "releasePrecision") {
    const precision = validateFieldValue(
      printingFieldRules.releasePrecision.unwrap(),
      field,
      value,
    ) as ReleasePrecision;
    if (before.releasedAt === null) {
      throw invalidRelease("Set a release date before its precision.");
    }
    const snapped = normalizeToPeriodStart({ releasedAt: before.releasedAt, precision });
    return { releasedAt: snapped.releasedAt, releasePrecision: snapped.precision };
  }

  let release: SetRelease | null;
  if (value === null || typeof value === "string") {
    release =
      value === null
        ? { releasedAt: null, precision: null }
        : (parseReleaseInput(value, before.releasePrecision) ?? parseReleaseInput(value, null));
  } else {
    const pair = releasePairSchema.safeParse(value);
    release = pair.success
      ? parseReleaseInput(pair.data.releasedAt, pair.data.releasePrecision)
      : null;
  }
  if (release === null) {
    throw invalidRelease("Invalid value for releasedAt: use YYYY, YYYY-MM or YYYY-MM-DD.");
  }
  return { releasedAt: release.releasedAt, releasePrecision: release.precision };
}

/** Typography is only applied to a value taken verbatim from a source, never to admin-typed text. */
export async function normalizePrintingFieldValue(
  repos: NormalizeRepos,
  args: {
    printingId: string;
    field: AcceptPrintingField;
    value: unknown;
    source: PrintingFieldSource;
    side?: 1 | 2;
  },
): Promise<unknown> {
  const { printingId, field, value, source, side = 1 } = args;

  if (field === "releasedAt" || field === "releasePrecision") {
    return normalizeReleaseValue(repos, printingId, field, value);
  }

  let normalized: unknown = value;
  if (field === "rarity" && typeof value === "string") {
    const rarityRows = await repos.rarities.listAll();
    const raritySlugs = rarityRows.map((row) => row.slug);
    normalized = raritySlugs.find((slug) => slug.toLowerCase() === value.toLowerCase()) ?? value;
  }

  normalized = validateFieldValue(
    printingFieldRules[field as keyof typeof printingFieldRules],
    field,
    normalized,
  );

  if (source === "provider" && typeof normalized === "string") {
    const costKeywords = TYPOGRAPHY_TEXT_FIELDS.has(field)
      ? await repos.keywords.listCostKeywords()
      : [];
    const setTotal =
      field === "publicCode"
        ? await repos.catalogMutations.getSetPrintedTotalForPrinting(printingId, side)
        : null;
    normalized = normalizeProvidedPrintingValue(field, normalized, {
      costKeywords,
      printedTotal: setTotal?.printedTotal ?? null,
    });
  }

  return normalized;
}

/** Returns the human-readable value to audit: for `setId` the slug, not the UUID written. */
export async function writePrintingField(
  transact: Transact,
  repos: WriteRepos,
  args: { printingId: string; field: AcceptPrintingField; value: unknown; side?: 1 | 2 },
): Promise<{ auditValue: unknown }> {
  const { printingId, field, value, side = 1 } = args;
  const mut = repos.catalogMutations;

  if (field === "markerSlugs" || field === "distributionChannelSlugs") {
    const newSlugs = Array.isArray(value)
      ? (value as string[]).filter((s) => typeof s === "string")
      : [];
    await (field === "markerSlugs"
      ? updatePrintingMarkers(transact, printingId, newSlugs, side)
      : updatePrintingDistributionChannels(
          { catalogMutations: mut, distributionChannels: repos.distributionChannels },
          printingId,
          newSlugs,
        ));
    return { auditValue: newSlugs };
  }

  if (field === "releasedAt" || field === "releasePrecision") {
    const release = value as ReleaseWrite;
    await mut.updatePrintingById(printingId, {
      releasedAt: release.releasedAt,
      releasePrecision: release.releasePrecision,
    });
    return { auditValue: release };
  }

  let written: unknown = value;
  if (field === "setId" && typeof written === "string" && written !== "") {
    const setRow = await repos.sets.getBySlug(written);
    assertFound(setRow, `Set not found: ${written}`);
    written = setRow.id;
  }

  try {
    await mut.updatePrintingFieldById(printingId, field, written, side);
  } catch (error: unknown) {
    throw asFieldWriteError(error, field, written);
  }

  if (field === "printedRulesText" || field === "printedEffectText") {
    await repos.keywords.recomputeForPrintingCard(printingId);
    await repos.cardTokens.recomputeForPrintingCard(printingId);
    await repos.catalog.refreshCardAggregates();
  }

  return { auditValue: value };
}
