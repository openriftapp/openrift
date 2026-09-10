import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import type {
  AdminCardDetailResponse,
  ProviderSettingResponse,
} from "@openrift/shared/types/api/admin";

export interface CompareColumn {
  id: string;
  provider: string;
  label: string;
  externalId: string;
  isTrusted: boolean;
  isContributor: boolean;
  isChecked: boolean;
  candidatePrintingIds: string[];
  uncheckedPrintingIds: string[];
}

export interface CompareColumnFilter {
  hidden?: ReadonlySet<string>;
  uncheckedOnly?: boolean;
}

function columnOrder(settings: Map<string, ProviderSettingResponse>) {
  return (a: CompareColumn, b: CompareColumn): number => {
    const aOrder = settings.get(a.provider)?.sortOrder ?? 0;
    const bOrder = settings.get(b.provider)?.sortOrder ?? 0;
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    return a.label.localeCompare(b.label);
  };
}

export function buildCompareColumns(
  detail: AdminCardDetailResponse,
  providerSettings: readonly ProviderSettingResponse[],
  filter: CompareColumnFilter = {},
): CompareColumn[] {
  const settings = new Map(providerSettings.map((setting) => [setting.provider, setting]));
  const printingsBySource = Map.groupBy(
    detail.candidatePrintings,
    (candidate) => candidate.candidateCardId,
  );

  const hiddenProviders = new Set(
    providerSettings.filter((setting) => setting.isHidden).map((setting) => setting.provider),
  );

  const columns = detail.sources
    .filter((source) => !hiddenProviders.has(source.provider))
    .map((source): CompareColumn => {
      const printings = printingsBySource.get(source.id) ?? [];
      const unchecked = printings.filter((candidate) => candidate.checkedAt === null);
      const isContributor = source.provider === USER_SUBMISSION_PROVIDER;
      return {
        id: source.id,
        provider: source.provider,
        label: isContributor ? (source.submittedByName ?? "Contributor") : source.provider,
        externalId: source.externalId,
        isTrusted: settings.get(source.provider)?.isFavorite ?? false,
        isContributor,
        isChecked: source.checkedAt !== null && unchecked.length === 0,
        candidatePrintingIds: printings.map((candidate) => candidate.id),
        uncheckedPrintingIds: unchecked.map((candidate) => candidate.id),
      };
    });

  const hidden = filter.hidden;
  return columns
    .filter((column) => !(hidden?.has(column.id) ?? false))
    .filter((column) => filter.uncheckedOnly !== true || !column.isChecked)
    .toSorted(columnOrder(settings));
}
