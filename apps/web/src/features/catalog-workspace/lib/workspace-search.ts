import {
  WORKSPACE_REASONS,
  WORKSPACE_RECORD_FILTER_VALUES,
} from "@openrift/shared/workspace-kinds";
import { z } from "zod/mini";

import { lenient } from "@/lib/lenient-param";

const WORKSPACE_VIEWS = ["open", "new", "all"] as const;

export const WORKSPACE_SORTS = ["oldest", "newest", "card"] as const;

export const DESK_SORTS = ["code", "card", "updated", "release"] as const;

export const DESK_STATUSES = ["announced", "released"] as const;

export const workspaceSearchSchema = z.object({
  segment: lenient(z.enum(WORKSPACE_VIEWS)),
  order: lenient(z.enum(WORKSPACE_SORTS)),
  provider: lenient(z.string().check(z.minLength(1))),
  reason: lenient(z.enum(WORKSPACE_REASONS)),
  q: lenient(z.string()),
  collapsed: lenient(z.boolean()),
  filter: lenient(z.enum(WORKSPACE_RECORD_FILTER_VALUES)),
  status: lenient(z.enum(DESK_STATUSES)),
  deskSort: lenient(z.enum(DESK_SORTS)),
});

export const printingPrefillSearchSchema = z.object({
  card: lenient(z.string().check(z.minLength(1))),
  language: lenient(z.string().check(z.minLength(1))),
  finish: lenient(z.string().check(z.minLength(1))),
});

export type PrintingPrefill = z.infer<typeof printingPrefillSearchSchema>;
export type WorkspaceView = (typeof WORKSPACE_VIEWS)[number];
export type WorkspaceSort = (typeof WORKSPACE_SORTS)[number];
export type WorkspaceSearch = z.infer<typeof workspaceSearchSchema>;
