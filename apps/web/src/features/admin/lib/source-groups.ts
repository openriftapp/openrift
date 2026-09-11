import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import type {
  AdminCardDetailResponse,
  ProviderSettingResponse,
} from "@openrift/shared/types/api/admin";

export interface OverviewSourceGroup {
  key: string;
  label: string;
  isContributor: boolean;
  isTrusted: boolean;
  rowCount: number;
  isChecked: boolean;
  candidateCardIds: string[];
  uncheckedPrintingIds: string[];
}

type SourceGroupInput = Pick<AdminCardDetailResponse, "sources" | "candidatePrintings">;

export function buildOverviewSourceGroups(
  detail: SourceGroupInput,
  providerSettings: readonly ProviderSettingResponse[],
): OverviewSourceGroup[] {
  const trusted = new Set(
    providerSettings.filter((setting) => setting.isFavorite).map((setting) => setting.provider),
  );
  const printingsBySource = Map.groupBy(
    detail.candidatePrintings,
    (candidate) => candidate.candidateCardId,
  );

  const grouped = Map.groupBy(detail.sources, (source) =>
    source.provider === USER_SUBMISSION_PROVIDER
      ? `${source.provider}:${source.submittedByName ?? ""}`
      : source.provider,
  );

  return [...grouped].flatMap(([key, sources]) => {
    const first = sources.at(0);
    if (first === undefined) {
      return [];
    }
    const isContributor = first.provider === USER_SUBMISSION_PROVIDER;
    const isChecked = sources.every(
      (source) =>
        source.checkedAt !== null &&
        (printingsBySource.get(source.id) ?? []).every((candidate) => candidate.checkedAt !== null),
    );
    return [
      {
        key,
        label: isContributor ? (first.submittedByName ?? "Contributor") : first.provider,
        isContributor,
        isTrusted: trusted.has(first.provider),
        rowCount: sources.length,
        isChecked,
        candidateCardIds: sources.filter((source) => source.checkedAt === null).map((s) => s.id),
        uncheckedPrintingIds: sources.flatMap((source) =>
          (printingsBySource.get(source.id) ?? [])
            .filter((candidate) => candidate.checkedAt === null)
            .map((candidate) => candidate.id),
        ),
      },
    ];
  });
}
