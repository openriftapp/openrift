import type { AcceptPrintingField } from "@openrift/shared/contracts/admin/card-mutations";
import { printingFieldRules } from "@openrift/shared/db-field-rules";
import { ERROR_CODES } from "@openrift/shared/error-codes";
import { appendSetTotal, fixTypography } from "@openrift/shared/fix-typography";

import type { Repos, Transact } from "../../../deps.js";
import { AppError } from "../../../errors.js";
import { assertFound } from "../../../lib/assertions.js";
import { updatePrintingDistributionChannels, updatePrintingMarkers } from "./printing-admin.js";

export type PrintingFieldSource = "provider" | "manual";

type NormalizeRepos = Pick<Repos, "catalogMutations" | "rarities" | "keywords">;
type WriteRepos = Pick<
  Repos,
  "catalogMutations" | "cardTokens" | "catalog" | "distributionChannels" | "keywords" | "sets"
>;

const TYPOGRAPHY_TEXT_FIELDS = new Set(["printedRulesText", "printedEffectText"]);

/** Typography is only applied to a value taken verbatim from a source, never to admin-typed text. */
export async function normalizePrintingFieldValue(
  repos: NormalizeRepos,
  args: {
    printingId: string;
    field: AcceptPrintingField;
    value: unknown;
    source: PrintingFieldSource;
  },
): Promise<unknown> {
  const { printingId, field, value, source } = args;

  let normalized: unknown = value;
  if (field === "rarity" && typeof value === "string") {
    const rarityRows = await repos.rarities.listAll();
    const raritySlugs = rarityRows.map((row) => row.slug);
    normalized = raritySlugs.find((slug) => slug.toLowerCase() === value.toLowerCase()) ?? value;
  }

  const validator = printingFieldRules[field as keyof typeof printingFieldRules];
  if (validator) {
    const parsed = validator.safeParse(normalized);
    if (!parsed.success) {
      throw new AppError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        `Invalid value for ${field}: ${parsed.error.issues[0]?.message ?? "invalid value"}`,
      );
    }
    normalized = parsed.data;
  }

  if (source === "provider") {
    if (TYPOGRAPHY_TEXT_FIELDS.has(field) && typeof normalized === "string") {
      const costKeywords = await repos.keywords.listCostKeywords();
      normalized = fixTypography(normalized, { costKeywords });
    }
    if (field === "flavorText" && typeof normalized === "string") {
      normalized = fixTypography(normalized, { italicParens: false, keywordGlyphs: false });
    }
    if (field === "publicCode" && typeof normalized === "string") {
      const setTotal = await repos.catalogMutations.getSetPrintedTotalForPrinting(printingId);
      normalized = appendSetTotal(normalized, setTotal?.printedTotal);
    }
  }

  return normalized;
}

/** Returns the human-readable value to audit: for `setId` the slug, not the UUID written. */
export async function writePrintingField(
  transact: Transact,
  repos: WriteRepos,
  args: { printingId: string; field: AcceptPrintingField; value: unknown },
): Promise<{ auditValue: unknown }> {
  const { printingId, field, value } = args;
  const mut = repos.catalogMutations;

  if (field === "markerSlugs" || field === "distributionChannelSlugs") {
    const newSlugs = Array.isArray(value)
      ? (value as string[]).filter((s) => typeof s === "string")
      : [];
    await (field === "markerSlugs"
      ? updatePrintingMarkers(transact, printingId, newSlugs)
      : updatePrintingDistributionChannels(
          { catalogMutations: mut, distributionChannels: repos.distributionChannels },
          printingId,
          newSlugs,
        ));
    return { auditValue: newSlugs };
  }

  let written: unknown = value;
  if (field === "setId" && typeof written === "string" && written !== "") {
    const setRow = await repos.sets.getBySlug(written);
    assertFound(setRow, `Set not found: ${written}`);
    written = setRow.id;
  }

  try {
    await mut.updatePrintingFieldById(printingId, field, written);
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "23503") {
      throw new AppError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        `Invalid value for ${field}: ${String(written)}`,
      );
    }
    throw error;
  }

  if (field === "printedRulesText" || field === "printedEffectText") {
    await repos.keywords.recomputeForPrintingCard(printingId);
    await repos.cardTokens.recomputeForPrintingCard(printingId);
    await repos.catalog.refreshCardAggregates();
  }

  return { auditValue: value };
}
