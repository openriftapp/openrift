import { getSiteUrl } from "@/lib/site-config";

const SHARE_PATHS = {
  list: "lists/share",
  collection: "collections/share",
  deck: "decks/share",
  tierList: "tier-lists/share",
  bundle: "users/share",
  board: "board",
} as const;

export type ShareLinkKind = keyof typeof SHARE_PATHS;

export interface ShareState {
  shareToken: string | null;
  isPublic: boolean;
}

/**
 * The public URL for a shared surface, `null` when it isn't. Requires both
 * `isPublic` and a token: a leftover token alone would hand out a URL that 404s.
 */
export function shareLinkUrl(kind: ShareLinkKind, share: ShareState): string | null {
  if (!share.isPublic || share.shareToken === null) {
    return null;
  }
  return `${getSiteUrl()}/${SHARE_PATHS[kind]}/${share.shareToken}`;
}
