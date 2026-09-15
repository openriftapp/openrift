import type { BoardDocument } from "@openrift/shared/board-state";
import type { Generated } from "kysely";

import type { CreatedAt, UpdatedAt } from "./columns.js";

export interface BoardStatesTable {
  id: Generated<string>;
  userId: string;
  title: string;
  answer: string | null;
  coreRulesVersion: string | null;
  tournamentRulesVersion: string | null;
  document: BoardDocument;
  isPublic: Generated<boolean>;
  shareToken: string | null;
  isFeatured: Generated<boolean>;
  createdAt: CreatedAt;
  updatedAt: UpdatedAt;
}
