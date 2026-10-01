import { errataContract } from "@openrift/shared/contracts/errata";
import type { ErrataListResponse } from "@openrift/shared/contracts/errata";
import { implement } from "@orpc/server";

import { requireUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { buildErrataListResponse } from "../lib/errata-presenters.js";

const os = implement(errataContract).$context<ApiContext>().use(requireUser);

export const errataRouter = {
  list: os.list.handler(async ({ context }): Promise<ErrataListResponse> => {
    const { cardErrata } = context.repos;
    const [announcements, rows] = await Promise.all([
      cardErrata.announcements(),
      cardErrata.listEntries(),
    ]);
    return buildErrataListResponse(announcements, rows);
  }),
};
