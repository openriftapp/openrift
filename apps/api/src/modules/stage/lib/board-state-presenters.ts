import type { AdminBoardState } from "@openrift/shared/contracts/admin/board-states";
import type {
  BoardStateResponse,
  FeaturedBoardStateResponse,
  PublicBoardStateResponse,
} from "@openrift/shared/types/api/board-state";

import type { BoardState, BoardStateWithOwner } from "../repositories/board-states.js";

export function toBoardState(row: BoardState): BoardStateResponse {
  return {
    id: row.id,
    title: row.title,
    answer: row.answer,
    coreRulesVersion: row.coreRulesVersion,
    tournamentRulesVersion: row.tournamentRulesVersion,
    document: row.document,
    isPublic: row.isPublic,
    shareToken: row.shareToken,
    isFeatured: row.isFeatured,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPublicBoardState(row: BoardState): PublicBoardStateResponse {
  return {
    id: row.id,
    title: row.title,
    answer: row.answer,
    coreRulesVersion: row.coreRulesVersion,
    tournamentRulesVersion: row.tournamentRulesVersion,
    document: row.document,
    isFeatured: row.isFeatured,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Undefined for a row without a share token, which has no page to link to. */
export function toFeaturedBoardState(row: BoardState): FeaturedBoardStateResponse | undefined {
  if (row.shareToken === null) {
    return undefined;
  }
  return { ...toPublicBoardState(row), shareToken: row.shareToken };
}

export function toAdminBoardState(row: BoardStateWithOwner): AdminBoardState {
  return {
    id: row.id,
    title: row.title,
    ownerName: row.ownerName,
    coreRulesVersion: row.coreRulesVersion,
    tournamentRulesVersion: row.tournamentRulesVersion,
    stepCount: row.document.steps.length,
    shareToken: row.isPublic ? row.shareToken : null,
    isFeatured: row.isFeatured,
    updatedAt: row.updatedAt.toISOString(),
  };
}
