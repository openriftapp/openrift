import { createMediaQueryHook } from "@/hooks/create-media-query-hook";

/**
 * Tracks Tailwind's `sm` breakpoint, to unmount (not just CSS-hide) expensive chrome on phones.
 * True on the server so SSR keeps the desktop chrome; phones drop it right after hydration.
 */
export const useSmUp = createMediaQueryHook("(min-width: 640px)", true);
