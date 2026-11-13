import { createMediaQueryHook } from "@/hooks/create-media-query-hook";
import { MOBILE_QUERY } from "@/lib/media-query";

export const useIsMobile = createMediaQueryHook(MOBILE_QUERY, false);
