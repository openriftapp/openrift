import type {
  AdminMarketplaceName,
  UnifiedMappingGroupResponse,
  UnifiedMappingsCardResponse,
} from "@openrift/shared/types/api/admin";

export interface OptimisticAssignment {
  marketplace: AdminMarketplaceName;
  externalId: number;
  finish: string;
  language: string | null;
  printingId: string;
}

/**
 * A SKU is matched by its `(externalId, finish, language)` tuple, which
 * describes the marketplace's listing rather than the printing.
 */
function foldIntoGroup(
  group: UnifiedMappingGroupResponse,
  assignment: OptimisticAssignment,
): UnifiedMappingGroupResponse {
  const { marketplace, externalId, finish, language, printingId } = assignment;
  if (!group.printings.some((printing) => printing.printingId === printingId)) {
    return group;
  }
  const slice = group[marketplace];
  const index = slice.stagedProducts.findIndex(
    (product) =>
      product.externalId === externalId &&
      product.finish === finish &&
      product.language === language,
  );
  const moved = index === -1 ? undefined : slice.stagedProducts[index];
  return {
    ...group,
    [marketplace]: {
      ...slice,
      stagedProducts:
        index === -1
          ? slice.stagedProducts
          : [...slice.stagedProducts.slice(0, index), ...slice.stagedProducts.slice(index + 1)],
      assignedProducts: moved ? [...slice.assignedProducts, moved] : slice.assignedProducts,
      assignments: [...slice.assignments, { externalId, printingId, finish, language }],
    },
  };
}

export function applyOptimisticAssignments(
  response: UnifiedMappingsCardResponse,
  assignments: readonly OptimisticAssignment[],
): UnifiedMappingsCardResponse {
  if (response.group === null) {
    return response;
  }
  let group = response.group;
  for (const assignment of assignments) {
    group = foldIntoGroup(group, assignment);
  }
  return group === response.group ? response : { ...response, group };
}
