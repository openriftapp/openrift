import { boardStatesContract } from "@openrift/shared/contracts/board-states";
import type {
  BoardStateListResponse,
  BoardStateResponse,
  BoardStateShareResponse,
} from "@openrift/shared/types/api/board-state";
import type { RuleKind } from "@openrift/shared/types/api/rules";
import { trimToNull } from "@openrift/shared/utils";
import { implement } from "@orpc/server";

import { assertFound } from "../../../lib/assertions.js";
import { withUniqueShareToken } from "../../../lib/share-token.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { toBoardState } from "../lib/board-state-presenters.js";
import type { BoardStateValues } from "../repositories/board-states.js";

const NOT_FOUND = "Board state not found";

async function rulesVersionExists(
  context: ApiContext,
  kind: RuleKind,
  version: string,
): Promise<boolean> {
  const versions = await context.repos.rules.listVersions(kind);
  return versions.some((row) => row.version === version);
}

async function pinsExist(
  context: ApiContext,
  pins: { core: string | null; tournament: string | null },
): Promise<boolean> {
  if (pins.core !== null && !(await rulesVersionExists(context, "core", pins.core))) {
    return false;
  }
  return (
    pins.tournament === null || (await rulesVersionExists(context, "tournament", pins.tournament))
  );
}

const os = implement(boardStatesContract).$context<ApiContext>().use(requireAuthedUser);

export const boardStatesRouter = {
  list: os.list.handler(async ({ context }): Promise<BoardStateListResponse> => {
    const rows = await context.repos.boardStates.listForUser(context.userId);
    return { items: rows.map((row) => toBoardState(row)) };
  }),

  get: os.get.handler(async ({ input, context }): Promise<BoardStateResponse> => {
    const row = await context.repos.boardStates.getByIdForUser(input.id, context.userId);
    assertFound(row, NOT_FOUND);
    return toBoardState(row);
  }),

  create: os.create.handler(async ({ input, context, errors }): Promise<BoardStateResponse> => {
    const pins = { core: input.coreRulesVersion, tournament: input.tournamentRulesVersion };
    if (!(await pinsExist(context, pins))) {
      throw errors.BAD_REQUEST({ message: "Unknown rules version" });
    }
    const row = await context.repos.boardStates.create(context.userId, {
      title: input.title,
      answer: trimToNull(input.answer ?? ""),
      coreRulesVersion: input.coreRulesVersion,
      tournamentRulesVersion: input.tournamentRulesVersion,
      document: input.document,
    });
    return toBoardState(row);
  }),

  update: os.update.handler(async ({ input, context, errors }): Promise<BoardStateResponse> => {
    const { id, title, answer, coreRulesVersion, tournamentRulesVersion, document } = input;
    const { boardStates } = context.repos;

    const current = await boardStates.getByIdForUser(id, context.userId);
    assertFound(current, NOT_FOUND);

    // An explicit `undefined` key here reaches Kysely's SET clause and nulls the column.
    const values: Partial<BoardStateValues> = {};
    if (title !== undefined) {
      values.title = title;
    }
    if (answer !== undefined) {
      values.answer = trimToNull(answer ?? "");
    }
    if (coreRulesVersion !== undefined) {
      values.coreRulesVersion = coreRulesVersion;
    }
    if (tournamentRulesVersion !== undefined) {
      values.tournamentRulesVersion = tournamentRulesVersion;
    }
    if (document !== undefined) {
      values.document = document;
    }

    if (coreRulesVersion !== undefined || tournamentRulesVersion !== undefined) {
      const pins = {
        core: coreRulesVersion === undefined ? null : coreRulesVersion,
        tournament: tournamentRulesVersion === undefined ? null : tournamentRulesVersion,
      };
      const nextCore = coreRulesVersion === undefined ? current.coreRulesVersion : coreRulesVersion;
      const nextTournament =
        tournamentRulesVersion === undefined
          ? current.tournamentRulesVersion
          : tournamentRulesVersion;
      if (nextCore === null && nextTournament === null) {
        throw errors.BAD_REQUEST({ message: "Pin at least one rules version" });
      }
      if (!(await pinsExist(context, pins))) {
        throw errors.BAD_REQUEST({ message: "Unknown rules version" });
      }
    }

    if (Object.keys(values).length === 0) {
      // An empty values object would produce an empty SET, which is invalid SQL.
      return toBoardState(current);
    }

    const row = await boardStates.update(id, context.userId, values);
    assertFound(row, NOT_FOUND);
    return toBoardState(row);
  }),

  remove: os.remove.handler(async ({ input, context }): Promise<void> => {
    const deleted = await context.repos.boardStates.remove(input.id, context.userId);
    if (!deleted) {
      assertFound(undefined, NOT_FOUND);
    }
  }),

  share: os.share.handler(async ({ input, context }): Promise<BoardStateShareResponse> => {
    const { boardStates } = context.repos;
    const existing = await boardStates.getShareState(input.id, context.userId);
    assertFound(existing, NOT_FOUND);
    if (existing.shareToken !== null && existing.isPublic) {
      return { shareToken: existing.shareToken, isPublic: true };
    }

    const token = await withUniqueShareToken(async (candidate) => {
      const updated = await boardStates.setShare(input.id, context.userId, candidate, true);
      assertFound(updated, NOT_FOUND);
      return candidate;
    });
    return { shareToken: token, isPublic: true };
  }),

  unshare: os.unshare.handler(async ({ input, context }): Promise<void> => {
    const updated = await context.repos.boardStates.setShare(input.id, context.userId, null, false);
    assertFound(updated, NOT_FOUND);
  }),
};
