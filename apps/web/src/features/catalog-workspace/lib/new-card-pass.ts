import { hasFieldValue } from "@openrift/shared/catalog-field-compare";
import { cardFieldsSchema } from "@openrift/shared/contracts/admin/card-mutations";
import type { ReviewCard } from "@openrift/shared/contracts/admin/catalog-workspace";
import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import { formatPrintingCode } from "@openrift/shared/printing-code";
import { pluralize } from "@openrift/shared/strings";
import type {
  CandidateCardResponse,
  CandidatePrintingResponse,
} from "@openrift/shared/types/api/admin";

import type { PrintingValueLabels } from "@/features/admin/lib/field-value-text";
import { EMPTY_VALUE_TEXT, formatCatalogFieldValue } from "@/features/admin/lib/field-value-text";
import type { CreationDraft } from "@/features/catalog-workspace/lib/creation-draft";
import { NEW_CARD_KEY_PREFIX, providerName } from "@/features/catalog-workspace/lib/review-cards";

const NEW_CARD_FIELD_KEYS: ReadonlySet<string> = new Set(
  Object.keys(cardFieldsSchema.shape).filter((key) => key !== "id"),
);

export function newCardReviewKey(normName: string): string {
  return `${NEW_CARD_KEY_PREFIX}${normName}`;
}

export function reviewNeighborByKey(
  cards: readonly ReviewCard[],
  key: string,
  delta: 1 | -1,
  lastIndex: number,
  skipKey?: string,
): ReviewCard | null {
  const index = cards.findIndex((card) => card.key === key);
  let targetIndex: number;
  if (index !== -1) {
    targetIndex = index + delta;
  } else if (lastIndex === -1) {
    targetIndex = delta === 1 ? 0 : -1;
  } else {
    targetIndex = delta === 1 ? lastIndex : lastIndex - 1;
  }
  if (skipKey !== undefined && cards[targetIndex]?.key === skipKey) {
    targetIndex += delta;
  }
  return targetIndex < 0 ? null : (cards[targetIndex] ?? null);
}

export function newCardCreateLabel(printings: number): string {
  return printings === 0
    ? "Create card"
    : `Create card and ${printings} ${pluralize(printings, "printing")}`;
}

export function sourceDisplayName(source: CandidateCardResponse): string {
  return source.provider === USER_SUBMISSION_PROVIDER
    ? (source.submittedByName ?? providerName(source.provider))
    : source.provider;
}

interface NewCardFieldDef {
  key: string;
  label: string;
  readOnly?: boolean;
}

interface NewCardFieldAlternative {
  key: string;
  value: unknown;
  sources: string[];
}

interface NewCardFieldRow {
  key: string;
  label: string;
  value: unknown;
  alternatives: NewCardFieldAlternative[];
}

export function newCardFieldRows(
  fields: readonly NewCardFieldDef[],
  sources: readonly CandidateCardResponse[],
  active: Readonly<Record<string, unknown>>,
  usable: (field: string, value: unknown) => boolean,
): NewCardFieldRow[] {
  return fields
    .filter((field) => field.readOnly !== true && NEW_CARD_FIELD_KEYS.has(field.key))
    .map((field) => {
      const value = active[field.key] ?? null;
      const picked = JSON.stringify(value);
      const byValue = new Map<string, NewCardFieldAlternative>();
      for (const source of sources) {
        const candidate = (source as unknown as Record<string, unknown>)[field.key];
        if (!hasFieldValue(candidate) || !usable(field.key, candidate)) {
          continue;
        }
        const key = JSON.stringify(candidate);
        if (key === picked) {
          continue;
        }
        const name = sourceDisplayName(source);
        const existing = byValue.get(key);
        if (existing === undefined) {
          byValue.set(key, { key, value: candidate, sources: [name] });
        } else if (!existing.sources.includes(name)) {
          existing.sources.push(name);
        }
      }
      return { key: field.key, label: field.label, value, alternatives: [...byValue.values()] };
    });
}

export function printingGroupProviders(
  draft: CreationDraft,
  candidatePrintings: readonly CandidatePrintingResponse[],
  sources: readonly CandidateCardResponse[],
): string[] {
  const ids = new Set(draft.candidatePrintingIds);
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const names = candidatePrintings
    .filter((candidate) => ids.has(candidate.id))
    .flatMap((candidate) => {
      const source = sourceById.get(candidate.candidateCardId);
      return source === undefined ? [] : [sourceDisplayName(source)];
    });
  return [...new Set(names)];
}

export function printingGroupLines(
  draft: CreationDraft,
  providers: readonly string[],
  labels: PrintingValueLabels,
): { summary: string; details: string } {
  const [first, second] = draft.faces;
  const fields = first?.fields;
  const summary =
    fields === undefined
      ? []
      : [
          fields.codeTba ? "Code TBA" : formatPrintingCode(fields.publicCode || fields.shortCode),
          formatCatalogFieldValue("artVariant", fields.artVariant, labels),
          formatCatalogFieldValue("finish", fields.finish, labels),
          fields.language,
          formatCatalogFieldValue("rarity", fields.rarity, labels),
        ];
  const channels = draft.printing.distributionChannelSlugs;
  const details = [
    formatCatalogFieldValue("size", draft.printing.size, labels),
    channels.length > 0
      ? formatCatalogFieldValue("distributionChannelSlugs", channels, labels)
      : null,
    second?.mode === "existing" ? `second face ${second.label}` : null,
    providers.length > 0 ? `from ${providers.join(", ")}` : null,
  ];
  const kept = (parts: readonly (string | null)[]) =>
    parts.filter(
      (part): part is string => part !== null && part !== "" && part !== EMPTY_VALUE_TEXT,
    );
  return { summary: kept(summary).join(" · "), details: kept(details).join(" · ") };
}
