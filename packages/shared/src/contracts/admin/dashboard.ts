import { isoDate } from "@openrift/shared/schemas";
import { z } from "zod";

import { authedRoute } from "../_base.js";
import { adminAppStatsSchema } from "./status.js";

export const ADMIN_GROWTH_METRICS = [
  "users",
  "collections",
  "userDecks",
  "metaDecks",
  "wishlists",
  "tradelists",
  "friendGroups",
] as const;

export type AdminGrowthMetric = (typeof ADMIN_GROWTH_METRICS)[number];

const growthDaySchema = z.object({ date: isoDate, count: z.number() });
const growthSeries = z.array(growthDaySchema);

export const adminDashboardResponseSchema = z.object({
  app: adminAppStatsSchema,
  growth: z.object({
    users: growthSeries,
    collections: growthSeries,
    userDecks: growthSeries,
    metaDecks: growthSeries,
    wishlists: growthSeries,
    tradelists: growthSeries,
    friendGroups: growthSeries,
  } satisfies Record<AdminGrowthMetric, typeof growthSeries>),
});

const TAG = "Admin";

export const adminDashboardContract = {
  get: authedRoute
    .route({ method: "GET", path: "/api/admin/v1/dashboard", tags: [TAG] })
    .output(adminDashboardResponseSchema),
};

export type AdminDashboardContract = typeof adminDashboardContract;
export type AdminDashboardResponse = z.infer<typeof adminDashboardResponseSchema>;
export type AdminGrowthSeries = AdminDashboardResponse["growth"];
export type AdminGrowthDay = z.infer<typeof growthDaySchema>;
