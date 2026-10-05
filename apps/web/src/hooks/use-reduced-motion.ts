import { createMediaQueryHook } from "@/hooks/create-media-query-hook";

export const useReducedMotion = createMediaQueryHook("(prefers-reduced-motion: reduce)", false);
