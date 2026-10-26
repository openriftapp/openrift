import type { CustomTagsResponse } from "@openrift/shared/types/api/custom-tags";
import { useSuspenseQuery } from "@tanstack/react-query";

import { customTagsQueryOptions } from "@/features/cards/lib/custom-tags-queries";

export function useCustomTagAssignments(): Record<string, readonly string[]> {
  const { data } = useSuspenseQuery({
    ...customTagsQueryOptions,
    select: (response: CustomTagsResponse) => response.assignments,
  });
  return data;
}
