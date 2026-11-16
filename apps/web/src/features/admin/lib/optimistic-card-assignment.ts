import type {
  AdminMarketplaceName,
  UnifiedMappingGroupResponse,
  UnifiedMappingsCardResponse,
} from "@openrift/shared/types/api/admin";

/**
 * SKU is matched by the `(externalId, finish, language)` tuple the caller
 * passes through — finish/language describe the marketplace's SKU, not the printing's.
 */
function applyOptimisticAssignmentToGroup(
  group: UnifiedMappingGroupResponse,
  marketplace: AdminMarketplaceName,
  externalId: number,
  finish: string,
  language: string | null,
  printingId: string,
): UnifiedMappingGroupResponse {
  const printing = group.printings.find((p) => p.printingId === printingId);
  if (!printing) {
    return group;
  }
  const mk = group[marketplace];
  const alreadyAssigned = mk.assignments.some(
    (a) =>
      a.externalId === externalId &&
      a.finish === finish &&
      a.printingId === printingId &&
      (a.language === null || a.language === language),
  );
  if (alreadyAssigned) {
    return group;
  }
  const variantIdx = mk.stagedProducts.findIndex(
    (p) => p.externalId === externalId && p.finish === finish && p.language === language,
  );
  const variant = variantIdx === -1 ? undefined : mk.stagedProducts[variantIdx];
  const nextStaged =
    variantIdx === -1
      ? mk.stagedProducts
      : [...mk.stagedProducts.slice(0, variantIdx), ...mk.stagedProducts.slice(variantIdx + 1)];
  const nextAssigned = variant ? [...mk.assignedProducts, variant] : mk.assignedProducts;
  const nextAssignments = [
    ...mk.assignments,
    {
      externalId,
      printingId,
      finish,
      language,
    },
  ];
  return {
    ...group,
    [marketplace]: {
      ...mk,
      stagedProducts: nextStaged,
      assignedProducts: nextAssigned,
      assignments: nextAssignments,
    },
  };
}

/** Folds a single (product SKU → printing) assignment into the cached {@link UnifiedMappingsCardResponse}. */
export function applyOptimisticAssignmentForCard(
  response: UnifiedMappingsCardResponse,
  marketplace: AdminMarketplaceName,
  externalId: number,
  finish: string,
  language: string | null,
  printingId: string,
): UnifiedMappingsCardResponse {
  if (!response.group) {
    return response;
  }
  const nextGroup = applyOptimisticAssignmentToGroup(
    response.group,
    marketplace,
    externalId,
    finish,
    language,
    printingId,
  );
  if (nextGroup === response.group) {
    return response;
  }
  return { ...response, group: nextGroup };
}
