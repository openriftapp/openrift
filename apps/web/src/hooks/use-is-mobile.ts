import { createMediaQueryHook } from "@/hooks/create-media-query-hook";

const MOBILE_BREAKPOINT = 768;

export const useIsMobile = createMediaQueryHook(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`, false);
