import { tournamentPlayriftboundContract } from "@openrift/shared/contracts/tournament-playriftbound";
import type {
  PlayriftboundSyncResponse,
  PlayriftboundSyncTargetsResponse,
} from "@openrift/shared/types/api/tournament";
import { implement } from "@orpc/server";

import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { loadTournament, requireManage } from "../lib/tournament-access.js";
import { buildSummaries } from "../lib/tournament-builders.js";
import { syncPlayriftboundEvent } from "../services/playriftbound-sync.js";

const os = implement(tournamentPlayriftboundContract).$context<ApiContext>().use(requireAuthedUser);

const MANAGING_ROLES = new Set(["host", "organizer"]);

export const tournamentPlayriftboundRouter = {
  targets: os.targets.handler(
    async ({ input, context }): Promise<PlayriftboundSyncTargetsResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const [orgIds, judgeOrgIds] = await Promise.all([
        repos.organizations.listIdsForUser(userId),
        repos.organizations.listJudgeOrgIdsForUser(userId),
      ]);
      const hostOrgIds = [...orgIds, ...judgeOrgIds];
      const [current, linked] = await Promise.all([
        repos.tournaments.listCurrentForUser(userId, hostOrgIds, new Date()),
        repos.tournaments.listForUserByPlayriftboundEvent(userId, hostOrgIds, input.eventId),
      ]);
      const rows = [...new Map([...linked, ...current].map((row) => [row.id, row])).values()];
      const summaries = await buildSummaries(
        repos,
        rows,
        userId,
        new Set(orgIds),
        new Set(judgeOrgIds),
      );
      const items = summaries.filter(
        (item) =>
          item.status !== "cancelled" &&
          item.status !== "completed" &&
          item.myRoles.some((role) => MANAGING_ROLES.has(role)),
      );
      const linkedIds = new Set(linked.map((row) => row.id));
      return { items, linkedIds: items.filter((item) => linkedIds.has(item.id)).map((i) => i.id) };
    },
  ),

  sync: os.sync.handler(async ({ input, context }): Promise<PlayriftboundSyncResponse> => {
    const tournament = await loadTournament(context.repos, input.tournamentId);
    await requireManage(context.repos, tournament, context.userId);
    return syncPlayriftboundEvent(
      context.repos,
      context.transact,
      tournament,
      input.payload,
      context.config.appBaseUrl,
    );
  }),
};
