/* oxlint-disable unicorn/no-useless-undefined, promise/prefer-await-to-then, unicorn/prefer-top-level-await -- zod's `.catch(undefined)` is a sync fallback, not a Promise#catch */
import { workspaceReasonSchema } from "@openrift/shared/contracts/admin/catalog-workspace";
import { z } from "zod";

const WORKSPACE_VIEWS = ["open", "new", "all"] as const;

export const WORKSPACE_SORTS = ["oldest", "newest", "card"] as const;

export const workspaceSearchSchema = z.object({
  segment: z.enum(WORKSPACE_VIEWS).optional().catch(undefined),
  order: z.enum(WORKSPACE_SORTS).optional().catch(undefined),
  provider: z.string().min(1).optional().catch(undefined),
  reason: workspaceReasonSchema.optional().catch(undefined),
  q: z.string().optional().catch(undefined),
  collapsed: z.boolean().optional().catch(undefined),
});

export type WorkspaceView = (typeof WORKSPACE_VIEWS)[number];
export type WorkspaceSort = (typeof WORKSPACE_SORTS)[number];
export type WorkspaceSearch = z.infer<typeof workspaceSearchSchema>;
