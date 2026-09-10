import { getSiteUrl } from "@/lib/site-config";

const SHARE_PATHS = {
  list: "lists",
  collection: "collections",
  deck: "decks",
  tierList: "tier-lists",
  bundle: "users",
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
  return `${getSiteUrl()}/${SHARE_PATHS[kind]}/share/${share.shareToken}`;
}
