import { createMediaQueryHook } from "@/hooks/create-media-query-hook";
import { REDUCED_MOTION_QUERY } from "@/lib/media-query";

export const useReducedMotion = createMediaQueryHook(REDUCED_MOTION_QUERY, false);
