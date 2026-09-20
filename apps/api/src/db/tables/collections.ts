import type { CopyLink } from "@openrift/shared/types/api/collection";
import type { ActivityAction } from "@openrift/shared/types/enums";
import type { ColumnType, Generated } from "kysely";

import type { CreatedAt, UpdatedAt, UpdatedXid } from "./columns.js";

export interface CollectionsTable {
  id: Generated<string>;
  userId: string | null;
  groupId: string | null;
  name: string;
  description: string | null;
  isInbox: Generated<boolean>;
  sortOrder: Generated<number>;
  isPublic: Generated<boolean>;
  shareToken: string | null;
  createdAt: CreatedAt;
  updatedAt: UpdatedAt;
}

export interface CopiesTable {
  id: Generated<string>;
  printingId: string;
  collectionId: string;
  createdAt: CreatedAt;
  updatedAt: UpdatedAt;
  condition: string | null;
  grader: string | null;
  grade: number | null;
  notesPublic: string | null;
  notesPrivate: string | null;
  isAltered: Generated<boolean>;
  links: ColumnType<CopyLink[], CopyLink[] | undefined, CopyLink[]>;
  updatedXid: UpdatedXid;
}

/** Owner columns are snapshotted by the trigger: a tombstone outlives its collection. */
export interface CopyDeletionsTable {
  copyId: string;
  collectionId: string;
  userId: string | null;
  groupId: string | null;
  deletedAt: Generated<Date>;
  deletedXid: Generated<string>;
}

export interface CopyDeletionSweepTable {
  onlyRow: Generated<boolean>;
  prunedThroughXid: Generated<string>;
}

export interface CollectionDeckbuildingPrefsTable {
  userId: string;
  collectionId: string;
  available: boolean;
}

export interface CollectionSidebarPrefsTable {
  userId: string;
  collectionId: string;
  hidden: boolean;
}

export interface CollectionEventsTable {
  id: Generated<string>;
  userId: string;
  action: ActivityAction;
  printingId: string;
  copyId: string | null;
  fromCollectionId: string | null;
  fromCollectionName: string | null;
  toCollectionId: string | null;
  toCollectionName: string | null;
  createdAt: CreatedAt;
}
