import type {
  boardStateListResponseSchema,
  boardStateResponseSchema,
  boardStateShareResponseSchema,
} from "@openrift/shared/contracts/board-states";
import type {
  featuredBoardStateListResponseSchema,
  featuredBoardStateResponseSchema,
  publicBoardStateDetailResponseSchema,
  publicBoardStateResponseSchema,
} from "@openrift/shared/contracts/public-board-states";
import type { z } from "zod";

export type BoardStateResponse = z.infer<typeof boardStateResponseSchema>;
export type BoardStateListResponse = z.infer<typeof boardStateListResponseSchema>;
export type BoardStateShareResponse = z.infer<typeof boardStateShareResponseSchema>;

export type PublicBoardStateResponse = z.infer<typeof publicBoardStateResponseSchema>;
export type PublicBoardStateDetailResponse = z.infer<typeof publicBoardStateDetailResponseSchema>;
export type FeaturedBoardStateResponse = z.infer<typeof featuredBoardStateResponseSchema>;
export type FeaturedBoardStateListResponse = z.infer<typeof featuredBoardStateListResponseSchema>;
