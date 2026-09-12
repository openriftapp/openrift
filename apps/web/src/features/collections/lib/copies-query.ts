import { copiesContract } from "@openrift/shared/contracts/copies";
import type { CopyListResponse, CopyResponse } from "@openrift/shared/types/api/collection";

import { browserApiOrpcClient } from "@/lib/server-fns/orpc-client";

export async function fetchCopies(): Promise<CopyListResponse> {
  const allItems: CopyResponse[] = [];
  let cursor: string | null = null;

  do {
    // Annotated to break the cursor -> query -> page -> cursor inference cycle (TS otherwise widens to `any`).
    const page: CopyListResponse = await browserApiOrpcClient(copiesContract).list(
      cursor ? { cursor } : {},
    );
    allItems.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return { items: allItems, nextCursor: null };
}
