import { copiesContract } from "@openrift/shared/contracts/copies";
import type { CopyListResponse, CopyResponse } from "@openrift/shared/types/api/collection";

import { browserApiOrpcClient } from "@/lib/server-fns/orpc-client";

export interface CopiesFetchResult {
  items: CopyResponse[];
  deletedIds?: string[];
  syncedXid?: string;
}

export async function fetchCopies(
  since?: string,
  signal?: AbortSignal,
): Promise<CopiesFetchResult> {
  let items: CopyResponse[] = [];
  let deletedIds: string[] | undefined;
  let syncedXid: string | undefined;
  let cursor: string | null = null;
  let deltaCursor: string | null = null;

  do {
    // Annotated to break the cursor -> query -> page -> cursor inference cycle (TS otherwise widens to `any`).
    const page: CopyListResponse = await browserApiOrpcClient(copiesContract).list(
      {
        ...(cursor === null ? {} : { cursor }),
        ...(deltaCursor === null ? {} : { deltaCursor }),
        ...(since === undefined ? {} : { since }),
      },
      { signal },
    );
    // A watermarked read answered without deletions is the server falling back to a
    // full list mid-read; the delta pages already taken are not part of that list.
    if (since !== undefined && page.deletedIds === undefined && deletedIds !== undefined) {
      items = [];
      deletedIds = undefined;
      syncedXid = undefined;
    }
    items.push(...page.items);
    if (page.deletedIds !== undefined) {
      deletedIds = [...(deletedIds ?? []), ...page.deletedIds];
    }
    // The earliest watermark of the read: later pages are fetched after it, so
    // keeping the last would skip whatever was written while paging.
    syncedXid ??= page.syncedXid;
    cursor = page.nextCursor;
    deltaCursor = page.nextDeltaCursor ?? null;
  } while (cursor !== null || deltaCursor !== null);

  return { items, deletedIds, syncedXid };
}
