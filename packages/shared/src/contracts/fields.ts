import { z } from "zod";

export function nameField(max: number) {
  return z.string().trim().min(1).max(max);
}

export const shareStateResponseSchema = z.object({
  shareToken: z.string().nullable(),
  isPublic: z.boolean(),
});

export const shareOwnerSchema = z.object({
  displayName: z.string(),
  gravatarHash: z.string().nullable(),
});
