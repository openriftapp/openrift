import { publicCustomTagSchema } from "@openrift/shared/contracts/init";
import { oc } from "@orpc/contract";
import { z } from "zod";

export const customTagsResponseSchema = z.object({
  tags: z.array(publicCustomTagSchema).meta({ examples: [[]] }),
  /** Card id to the slugs of the tags assigned to it. Untagged cards are absent. */
  assignments: z.record(z.string(), z.array(z.string())).meta({
    examples: [{ "019cfc3b-0389-744b-837c-792fd586300e": ["bandle-city"] }],
  }),
});

export const customTagsContract = {
  get: oc
    .route({ method: "GET", path: "/api/v1/custom-tags", tags: ["Custom tags"] })
    .meta({ auth: "public", cache: "long", etag: true })
    .output(customTagsResponseSchema),
};

export type CustomTagsContract = typeof customTagsContract;
