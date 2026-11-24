import {
  WORKSPACE_RECORD_FILTER_VALUES,
  WORKSPACE_RECORD_SORTS,
} from "@openrift/shared/workspace-kinds";
import { z } from "zod/mini";

import { lenient } from "@/lib/lenient-param";

export const DESK_SORTS = ["code", "card", "updated", "release"] as const;

export const DESK_STATUSES = ["announced", "released"] as const;

export const workspaceCardsSearchSchema = z.object({
  q: lenient(z.string()),
  set: lenient(z.string().check(z.minLength(1))),
});

export const CARD_VIEWS = ["review", "images", "ready"] as const;

export type CardView = (typeof CARD_VIEWS)[number];

export const cardsRouteSearchSchema = z.extend(workspaceCardsSearchSchema, {
  queue: lenient(z.enum(CARD_VIEWS)),
});

export const facesSearchSchema = z.extend(workspaceCardsSearchSchema, {
  filter: lenient(z.enum(WORKSPACE_RECORD_FILTER_VALUES)),
  recordSort: lenient(z.enum(WORKSPACE_RECORD_SORTS)),
  recordDir: lenient(z.enum(["asc", "desc"])),
});

export const printingsSearchSchema = z.extend(facesSearchSchema, {
  status: lenient(z.enum(DESK_STATUSES)),
  deskSort: lenient(z.enum(DESK_SORTS)),
  desk: lenient(z.enum(["mine", "promos"])),
});

export const printingPrefillSearchSchema = z.object({
  card: lenient(z.string().check(z.minLength(1))),
  language: lenient(z.string().check(z.minLength(1))),
  finish: lenient(z.string().check(z.minLength(1))),
  duplicateFrom: lenient(z.uuid()),
});

export type PrintingPrefill = z.infer<typeof printingPrefillSearchSchema>;
export type WorkspaceSearch = z.infer<typeof printingsSearchSchema>;
