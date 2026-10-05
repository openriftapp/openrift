import { createMediaQueryHook } from "@/hooks/create-media-query-hook";

export const useIsLandscape = createMediaQueryHook("(orientation: landscape)", false);
