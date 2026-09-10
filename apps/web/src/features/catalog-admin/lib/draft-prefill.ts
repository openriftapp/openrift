import type { CreateCardBody } from "@openrift/shared/contracts/admin/card-mutations";
import type {
  CandidateCardResponse,
  CandidatePrintingResponse,
  ProviderSettingResponse,
  UnmatchedCardDetailResponse,
} from "@openrift/shared/types/api/admin";

import { hasFieldValue } from "@/features/catalog-admin/lib/catalog-field-labels";

export interface DraftCardFields {
  id: string;
  name: string;
  types: string[];
  superTypes: string[];
  domains: string[];
  tags: string[];
  might: string;
  energy: string;
  power: string;
}

export const DRAFT_REQUIRED_FIELDS = ["id", "name", "types", "domains"] as const;

export const DRAFT_REQUIRED_FIELD_LABELS: Record<(typeof DRAFT_REQUIRED_FIELDS)[number], string> = {
  id: "Card ID",
  name: "Name",
  types: "Type",
  domains: "Domains",
};

export function sortSourcesByPriority(
  sources: readonly CandidateCardResponse[],
  providerSettings: readonly ProviderSettingResponse[],
): CandidateCardResponse[] {
  const settings = new Map(providerSettings.map((setting) => [setting.provider, setting]));
  return sources.toSorted((a, b) => {
    const aOrder = settings.get(a.provider)?.sortOrder ?? 0;
    const bOrder = settings.get(b.provider)?.sortOrder ?? 0;
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    return a.provider.localeCompare(b.provider);
  });
}

function firstString(sources: readonly CandidateCardResponse[], key: string): string {
  for (const source of sources) {
    const value = (source as unknown as Record<string, unknown>)[key];
    if (hasFieldValue(value)) {
      return String(value);
    }
  }
  return "";
}

function firstList(sources: readonly CandidateCardResponse[], key: string): string[] {
  for (const source of sources) {
    const value = (source as unknown as Record<string, unknown>)[key];
    if (Array.isArray(value) && value.length > 0) {
      return value.map(String);
    }
  }
  return [];
}

export function buildDraftPrefill(
  detail: UnmatchedCardDetailResponse,
  providerSettings: readonly ProviderSettingResponse[],
): DraftCardFields {
  const sorted = sortSourcesByPriority(detail.sources, providerSettings);
  return {
    id: detail.defaultCardId,
    name: firstString(sorted, "name"),
    types: firstList(sorted, "types"),
    superTypes: firstList(sorted, "superTypes"),
    domains: firstList(sorted, "domains"),
    tags: firstList(sorted, "tags"),
    might: firstString(sorted, "might"),
    energy: firstString(sorted, "energy"),
    power: firstString(sorted, "power"),
  };
}

export function draftRulesText(
  detail: UnmatchedCardDetailResponse,
  providerSettings: readonly ProviderSettingResponse[],
): string {
  const sorted = sortSourcesByPriority(detail.sources, providerSettings);
  return firstString(sorted, "rulesText");
}

export function missingDraftFields(fields: DraftCardFields): string[] {
  return DRAFT_REQUIRED_FIELDS.filter((key) => !hasFieldValue(fields[key])).map(
    (key) => DRAFT_REQUIRED_FIELD_LABELS[key],
  );
}

function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function toCreateCardBody(fields: DraftCardFields): CreateCardBody {
  const body: CreateCardBody = {
    id: fields.id.trim(),
    name: fields.name.trim(),
    types: fields.types,
    domains: fields.domains,
  };
  if (fields.superTypes.length > 0) {
    body.superTypes = fields.superTypes;
  }
  if (fields.tags.length > 0) {
    body.tags = fields.tags;
  }
  const might = optionalNumber(fields.might);
  if (might !== undefined) {
    body.might = might;
  }
  const energy = optionalNumber(fields.energy);
  if (energy !== undefined) {
    body.energy = energy;
  }
  const power = optionalNumber(fields.power);
  if (power !== undefined) {
    body.power = power;
  }
  return body;
}

export interface DraftPrintingRow {
  candidate: CandidatePrintingResponse;
  sourceCount: number;
}

export function buildDraftPrintingRows(detail: UnmatchedCardDetailResponse): DraftPrintingRow[] {
  const byId = new Map(detail.candidatePrintings.map((printing) => [printing.id, printing]));
  const rows: DraftPrintingRow[] = [];
  const seen = new Set<string>();
  for (const group of detail.candidatePrintingGroups) {
    const candidates = group.shortCodes
      .map((id) => byId.get(id))
      .filter((candidate): candidate is CandidatePrintingResponse => candidate !== undefined);
    const first = candidates[0];
    if (!first) {
      continue;
    }
    for (const candidate of candidates) {
      seen.add(candidate.id);
    }
    rows.push({ candidate: first, sourceCount: candidates.length });
  }
  for (const candidate of detail.candidatePrintings) {
    if (!seen.has(candidate.id)) {
      rows.push({ candidate, sourceCount: 1 });
    }
  }
  return rows;
}
