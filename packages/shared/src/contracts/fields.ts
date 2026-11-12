import { z } from "zod";

export function nameField(max: number) {
  return z.string().trim().min(1).max(max);
}

export const shareStateResponseSchema = z.object({
  shareToken: z.string().nullable(),
  isPublic: z.boolean(),
});

export const shareOwnerDisplayNameSchema = z.string().nullable().meta({
  description:
    "The owner's display name, or null when the account has no name. Clients omit the byline then.",
});

export const shareOwnerSchema = z.object({
  displayName: shareOwnerDisplayNameSchema,
  gravatarHash: z.string().nullable(),
});

export const cardArtSchema = z.object({
  imageId: z.string(),
  landscape: z.boolean(),
});

export const cancelTradeIdsField = z.array(z.uuid()).max(1000).optional();

export const tradeCancelConflictDataSchema = z.object({
  trades: z.array(
    z.object({
      id: z.string(),
      cardId: z.string(),
      printingId: z.string(),
      quantity: z.number().int().positive(),
      counterpartyName: z.string().nullable(),
    }),
  ),
});

export type TradeCancelConflictData = z.infer<typeof tradeCancelConflictDataSchema>;

export const tradeCancelConflictError = {
  message: "This change would cancel pending trades. Confirm to cancel them.",
  data: tradeCancelConflictDataSchema,
};
