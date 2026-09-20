import type { badgesResponseSchema } from "@openrift/shared/contracts/badges";
import type { z } from "zod";

export type BadgesResponse = z.infer<typeof badgesResponseSchema>;
