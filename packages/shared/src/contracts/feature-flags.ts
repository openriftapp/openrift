import { oc } from "@orpc/contract";
import { z } from "zod";

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
