import { oc } from "@orpc/contract";
import { z } from "zod";

import { authedRoute } from "./_base.js";

export const featureFlagsResponseSchema = z.object({
  flags: z.record(z.string(), z.boolean()).meta({
    examples: [{ collection: true, decks: true }],
  }),
});

export const featureFlagsContract = {
  get: oc
    .route({ method: "GET", path: "/api/v1/feature-flags", tags: ["Feature Flags"] })
    .meta({ auth: "public", cache: "short", cacheVary: "viewer" })
    .output(featureFlagsResponseSchema),
};

export type FeatureFlagsContract = typeof featureFlagsContract;

export const SELF_SERVICE_FLAGS = ["deck-builder-beta"] as const;

export type SelfServiceFlag = (typeof SELF_SERVICE_FLAGS)[number];

export const ownFeatureFlagsContract = {
  set: authedRoute
    .route({ method: "PUT", path: "/api/v1/feature-flags/self", tags: ["Feature Flags"] })
    .input(z.object({ key: z.enum(SELF_SERVICE_FLAGS), enabled: z.boolean() }))
    .output(featureFlagsResponseSchema),
};

export type OwnFeatureFlagsContract = typeof ownFeatureFlagsContract;
