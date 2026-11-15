// Shared, long-lived QueryClient caching public, non-user-specific data across
// SSR requests. Never put user-specific data here; auth-dependent queries must
// use the per-request QueryClient with forwarded cookies.

import { MINUTE_MS } from "@openrift/shared/format-date";
import { QueryClient } from "@tanstack/react-query";

const serverCache = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: MINUTE_MS,
      gcTime: 5 * MINUTE_MS,
    },
  },
});

export { serverCache };
