import { customTagsContract } from "@openrift/shared/contracts/custom-tags";
import type { CustomTagsResponse } from "@openrift/shared/types/api/custom-tags";
import { implement } from "@orpc/server";

import { requireUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { toPublicCustomTag } from "../lib/custom-tag-presenters.js";

const os = implement(customTagsContract).$context<ApiContext>().use(requireUser);

export const customTagsRouter = {
  get: os.get.handler(async ({ context }): Promise<CustomTagsResponse> => {
    const { customTags } = context.repos;
    const [rows, assignments] = await Promise.all([
      customTags.listAll(),
      customTags.assignmentsByCard(),
    ]);
    return {
      tags: rows.map((row) => toPublicCustomTag(row)),
      assignments: Object.fromEntries(assignments),
    };
  }),
};
