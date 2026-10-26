import { pluralize } from "@openrift/shared/strings";
import type { UnmatchedCardDetailResponse } from "@openrift/shared/types/api/admin";

import { buildPrintingGroups } from "@/features/admin/lib/candidate-printing-groups";
import type { CreationDraft, DraftCard } from "@/features/catalog-workspace/lib/creation-draft";
import {
  draftFromCandidatePrinting,
  validateDraft,
} from "@/features/catalog-workspace/lib/creation-draft";

export interface NewCardGroup {
  key: string;
  label: string;
  sourceCount: number;
  draft: CreationDraft;
}

export interface GroupFailure<T> {
  item: T;
  error: unknown;
}

export function isDraftComplete(draft: CreationDraft): boolean {
  return (
    draft.faces.length > 0 &&
    draft.candidatePrintingIds.length > 0 &&
    validateDraft(draft).length === 0
  );
}

function draftLabel(draft: CreationDraft): string {
  const fields = draft.faces.at(0)?.fields;
  if (fields === undefined) {
    return "Printing";
  }
  const parts = [fields.shortCode, fields.language, fields.finish].filter(
    (part) => part.length > 0,
  );
  return parts.length === 0 ? "Printing" : parts.join(" · ");
}

export function seedNewCardGroups(
  detail: Pick<
    UnmatchedCardDetailResponse,
    "sources" | "candidatePrintings" | "candidatePrintingGroups"
  >,
  compareProviders: (a: string, b: string) => number,
  card: DraftCard,
): NewCardGroup[] {
  const providerOf = new Map(detail.sources.map((source) => [source.id, source.provider]));
  return buildPrintingGroups(detail.candidatePrintingGroups, detail.candidatePrintings).flatMap(
    (group) => {
      const [best] = group.candidates.toSorted((a, b) =>
        compareProviders(
          providerOf.get(a.candidateCardId) ?? "",
          providerOf.get(b.candidateCardId) ?? "",
        ),
      );
      if (best === undefined) {
        return [];
      }
      const seeded = draftFromCandidatePrinting(
        card,
        best,
        providerOf.get(best.candidateCardId) ?? "",
      );
      const draft = {
        ...seeded,
        candidatePrintingIds: group.candidates.map((candidate) => candidate.id),
      };
      const sourceCount = group.candidates.length;
      return [
        {
          key: group.groupKey,
          label: `${draftLabel(draft)} (${sourceCount} ${pluralize(sourceCount, "source")})`,
          sourceCount,
          draft,
        },
      ];
    },
  );
}

export function checkedGroupKeys(
  groups: readonly NewCardGroup[],
  picks: ReadonlyMap<string, boolean>,
): string[] {
  return groups
    .filter((group) => isDraftComplete(group.draft) && (picks.get(group.key) ?? true))
    .map((group) => group.key);
}

export async function runInSequence<T>(
  items: readonly T[],
  run: (item: T) => Promise<unknown>,
): Promise<GroupFailure<T>[]> {
  const failures: GroupFailure<T>[] = [];
  for (const item of items) {
    try {
      await run(item);
    } catch (error) {
      failures.push({ item, error });
    }
  }
  return failures;
}
