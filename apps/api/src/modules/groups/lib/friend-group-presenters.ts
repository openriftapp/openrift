import type { AdminGroupBannersResponse } from "@openrift/shared/contracts/admin/friend-group-banners";
import type { ContactMethod } from "@openrift/shared/types/api/contact-method";
import type {
  FriendGroupCollectionShareResponse,
  FriendGroupDiscordLinksResponse,
  FriendGroupListResponse,
  FriendGroupMemberPreview,
  FriendGroupMemberResponse,
  FriendGroupRequestResponse,
  FriendGroupResponse,
  FriendGroupRole,
  FriendGroupSharedListDetailResponse,
  FriendGroupShareResponse,
  FriendGroupSummaryResponse,
} from "@openrift/shared/types/api/friend-group";

import { toCardArt } from "../../../lib/card-art.js";
import { gravatarHashForEmail } from "../../../lib/gravatar.js";
import { isoOrNull } from "../../../lib/iso-date.js";
import { tradeDefaultsFromList } from "../../lists/lib/list-presenters.js";
import type { DiscordLink } from "../repositories/friend-group-discord-links.js";
import type { GroupSummary } from "../repositories/friend-groups-core.js";
import type {
  Group,
  GroupBannerRow,
  GroupInvite,
  MemberPreviewRow,
  MemberWithUser,
  SharedListRow,
} from "../repositories/friend-groups-shared.js";
import { hasRole } from "./group-access.js";

/** Max cover printings per shared collection (a CardFan holds four). */
export const COLLECTION_COVER_COUNT = 4;

export interface ShareRow {
  groupId: string;
  listId: string;
  userId: string;
  sharedAt: Date;
  listName: string;
  listIntent: string;
  listKind: string;
  entryCount: number;
  userName: string | null;
}

export interface CollectionShareRow {
  groupId: string;
  collectionId: string;
  userId: string;
  sharedAt: Date;
  collectionName: string;
  userName: string | null;
  copyCount: number;
}

export interface CollectionCoverRow {
  collectionId: string;
  printingId: string;
  imageId: string;
}

export interface PendingRequestRow {
  id: string;
  userId: string;
  createdAt: Date;
  userName: string | null;
  userEmail: string;
  userImage: string | null;
}

export function toGroup(row: Group, includeCode: boolean): FriendGroupResponse {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    bannerUrl: row.bannerUrl,
    bannerPosition: row.bannerPosition,
    code: includeCode ? row.code : null,
    codeRotatedAt: row.codeRotatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toMemberPreview(row: MemberPreviewRow): FriendGroupMemberPreview {
  return {
    userId: row.userId,
    userName: row.userName,
    userImage: row.userImage,
    gravatarHash: gravatarHashForEmail(row.userEmail),
  };
}

export function toMember(
  row: MemberWithUser,
  contactMethods: ContactMethod[],
): FriendGroupMemberResponse {
  return {
    userId: row.userId,
    userName: row.userName,
    userImage: row.userImage,
    gravatarHash: gravatarHashForEmail(row.userEmail),
    role: row.role,
    contactMethods,
    joinedAt: row.joinedAt.toISOString(),
  };
}

export function toShare(row: ShareRow): FriendGroupShareResponse {
  return {
    groupId: row.groupId,
    listId: row.listId,
    listName: row.listName,
    listIntent: row.listIntent as FriendGroupShareResponse["listIntent"],
    listKind: row.listKind as FriendGroupShareResponse["listKind"],
    entryCount: row.entryCount,
    userId: row.userId,
    userName: row.userName,
    sharedAt: row.sharedAt.toISOString(),
  };
}

export function groupCovers(rows: CollectionCoverRow[]): Map<string, CollectionCoverRow[]> {
  return Map.groupBy(rows, (row) => row.collectionId);
}

export function toCollectionShare(
  row: CollectionShareRow,
  covers: CollectionCoverRow[] = [],
  landscapeIds: ReadonlySet<string> = new Set(),
): FriendGroupCollectionShareResponse {
  return {
    groupId: row.groupId,
    collectionId: row.collectionId,
    collectionName: row.collectionName,
    userId: row.userId,
    userName: row.userName,
    sharedAt: row.sharedAt.toISOString(),
    copyCount: row.copyCount,
    coverPrintings: covers.map((cover) => ({
      printingId: cover.printingId,
      ...toCardArt(cover.imageId, landscapeIds),
    })),
  };
}

export function toRequest(row: PendingRequestRow): FriendGroupRequestResponse {
  return {
    id: row.id,
    userId: row.userId,
    userName: row.userName,
    userImage: row.userImage,
    gravatarHash: gravatarHashForEmail(row.userEmail),
    createdAt: row.createdAt.toISOString(),
  };
}

export function canSeeCode(role: FriendGroupRole): boolean {
  return hasRole(role, "admin");
}

export function toGroupSummary(row: GroupSummary): FriendGroupSummaryResponse {
  return {
    ...toGroup(row, canSeeCode(row.viewerRole)),
    viewerRole: row.viewerRole,
    memberCount: row.memberCount,
    pendingRequestCount: row.pendingRequestCount,
    sharedListCount: row.sharedListCount,
    memberPreviews: row.memberPreviews.map((preview) => toMemberPreview(preview)),
    recentTradedCardCount: row.recentTradedCardCount,
    tradedCardCount: row.tradedCardCount,
  };
}

export function toOutgoingRequest(
  row: GroupInvite & { groupName: string; groupSlug: string; memberCount: number },
): FriendGroupListResponse["outgoingRequests"][number] {
  return {
    id: row.id,
    groupId: row.groupId,
    groupSlug: row.groupSlug,
    groupName: row.groupName,
    createdAt: row.createdAt.toISOString(),
    memberCount: row.memberCount,
  };
}

export function toSharedList(row: SharedListRow): FriendGroupSharedListDetailResponse["list"] {
  return {
    id: row.list.id,
    name: row.list.name,
    intent: row.list.intent,
    kind: row.list.kind,
    ownerUserId: row.list.userId,
    ownerName: row.ownerName,
    tradeDefaults: tradeDefaultsFromList(row.list),
    currency: row.list.currency,
  };
}

/** Pending links (no guild yet) are not listed. */
export function toDiscordLink(
  link: DiscordLink,
): FriendGroupDiscordLinksResponse["items"][number] | null {
  if (link.guildId === null || link.linkedAt === null) {
    return null;
  }
  return {
    id: link.id,
    guildId: link.guildId,
    guildName: link.guildName,
    linkedAt: link.linkedAt.toISOString(),
  };
}

export function toAdminGroupBanner(
  row: GroupBannerRow,
): AdminGroupBannersResponse["items"][number] {
  return {
    groupId: row.groupId,
    groupSlug: row.slug,
    groupName: row.name,
    bannerUrl: row.bannerUrl,
    bannerPosition: row.bannerPosition,
    uploadedAt: isoOrNull(row.bannerUploadedAt),
    uploaderUserId: row.uploaderUserId,
    uploaderName: row.uploaderName,
    uploaderEmail: row.uploaderEmail,
    memberCount: row.memberCount,
  };
}
