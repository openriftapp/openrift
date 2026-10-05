import { createMediaQueryHook } from "@/hooks/create-media-query-hook";

/**
 * Tracks `(pointer: coarse)`, false on the server. Use over the `IS_COARSE_POINTER`
 * module constant anywhere the result affects rendered HTML.
 */
export const useCoarsePointer = createMediaQueryHook("(pointer: coarse)", false);
