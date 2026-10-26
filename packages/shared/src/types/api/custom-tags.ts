import type { customTagsResponseSchema } from "@openrift/shared/contracts/custom-tags";
import type { z } from "zod";

export type CustomTagsResponse = z.infer<typeof customTagsResponseSchema>;
