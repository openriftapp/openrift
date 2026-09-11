import type { Insertable, Selectable, Updateable } from "kysely";

import type {
  FriendGroupCollectionSharesTable,
  FriendGroupInvitesTable,
  FriendGroupListSharesTable,
  FriendGroupMembersTable,
  FriendGroupsTable,
} from "../../../db/tables/friend-groups.js";

export type Group = Selectable<FriendGroupsTable>;
export type GroupMember = Selectable<FriendGroupMembersTable>;
export type GroupInvite = Selectable<FriendGroupInvitesTable>;
export type GroupShare = Selectable<FriendGroupListSharesTable>;
export type GroupCollectionShare = Selectable<FriendGroupCollectionSharesTable>;

export type NewGroupValues = Pick<
  Insertable<FriendGroupsTable>,
  "slug" | "name" | "description" | "code"
>;

export type GroupUpdate = Pick<
  Updateable<FriendGroupsTable>,
  "slug" | "previousSlug" | "name" | "description" | "bannerPosition" | "updatedAt"
>;

export interface GroupBannerValues {
  bannerUrl: string;
  bannerPosition: number;
  bannerUploadedBy: string;
  bannerUploadedAt: Date;
}

export interface GroupBannerRow {
  groupId: string;
  slug: string;
  name: string;
  bannerUrl: string;
  bannerPosition: number;
  bannerUploadedAt: Date | null;
  uploaderUserId: string | null;
  uploaderName: string | null;
  uploaderEmail: string | null;
  memberCount: number;
}

export interface MemberWithUser extends GroupMember {
  userName: string | null;
  userEmail: string;
  userImage: string | null;
}

export interface SharedGroupRow {
  id: string;
  slug: string;
  name: string;
}

export interface MemberPreviewRow {
  userId: string;
  userName: string | null;
  userEmail: string;
  userImage: string | null;
}
