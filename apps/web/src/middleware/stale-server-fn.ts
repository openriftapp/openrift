import { createMiddleware } from "@tanstack/react-start";

import {
  isStartMissingServerFnError,
  STALE_SERVER_FN_HEADER,
  STALE_SERVER_FN_STATUS,
} from "@/lib/stale-server-fn-signal";

// Start answers an unknown server-function id with a 500 JSON body the client decodes to
// `undefined`. The text body serves bundles built before the header; drop it after one release.
export const staleServerFnMiddleware = createMiddleware().server(async ({ next, handlerType }) => {
  if (handlerType !== "serverFn") {
    return next();
  }
  try {
    return await next();
  } catch (error) {
    if (isStartMissingServerFnError(error)) {
      return new Response(error.message, {
        status: STALE_SERVER_FN_STATUS,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          [STALE_SERVER_FN_HEADER]: "1",
        },
      });
    }
    throw error;
  }
});
