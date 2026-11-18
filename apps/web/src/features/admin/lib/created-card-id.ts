import type { QueryClient } from "@tanstack/react-query";

import { adminCardDetailQueryOptions } from "@/features/admin/lib/admin-card-queries";
import { errorText } from "@/lib/error-text";

export type CreatedCardId = { ok: true; id: string } | { ok: false; reason: string };

/** Reads back a just-created card's id, which the create endpoints do not return. */
export async function readCreatedCardId(
  queryClient: QueryClient,
  cardSlug: string,
): Promise<CreatedCardId> {
  let reason = "the new card could not be read back";
  let id: string | undefined;
  try {
    const detail = await queryClient.query(adminCardDetailQueryOptions(cardSlug));
    id = detail.card?.id;
  } catch (error) {
    reason = errorText(error, reason);
  }
  return id === undefined ? { ok: false, reason } : { ok: true, id };
}
