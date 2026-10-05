import { DAY_MS } from "@openrift/shared/format-date";
import type {
  ProfileLastActive,
  PublicUserBundleResponse,
} from "@openrift/shared/types/api/user-share";

import { toCardArt } from "../../../lib/card-art.js";
import { parseListRules } from "../../lists/lib/list-presenters.js";
import type { BundleListSummary } from "../repositories/user-shares.js";

/** Coarse on purpose: the profile says how recently, never when. */
export function lastActiveBucket(lastActiveAt: Date | null, now: Date): ProfileLastActive | null {
  if (lastActiveAt === null) {
    return null;
  }
  const age = now.getTime() - lastActiveAt.getTime();
  if (age < DAY_MS) {
    return "today";
  }
  if (age < 7 * DAY_MS) {
    return "week";
  }
  if (age < 30 * DAY_MS) {
    return "month";
  }
  return "older";
}

export function toBundleList(
  row: BundleListSummary,
  expanded: { entryCount: number; previewImageIds: string[] } | undefined,
  matchCount: number | null,
  landscapeIds: ReadonlySet<string>,
): PublicUserBundleResponse["lists"][number] {
  const { list } = row;
  return {
    id: list.id,
    name: list.name,
    intent: list.intent,
    kind: list.kind,
    entryCount: expanded?.entryCount ?? row.entryCount,
    isPublic: list.isPublic,
    viaGroups: row.viaGroups,
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
    hasRule: parseListRules(list.rules).length > 0,
    previews: (expanded?.previewImageIds ?? []).map((imageId) => toCardArt(imageId, landscapeIds)),
    matchCount,
  };
}
