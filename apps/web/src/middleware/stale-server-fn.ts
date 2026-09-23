import { createMiddleware } from "@tanstack/react-start";

import { STALE_SERVER_FN_ERROR_PATTERN } from "@/lib/stale-bundle-reload";

// TanStack Start answers an unknown server-function id with a 500 JSON body the client
// decodes to `undefined`; a plain-text 404 makes the client throw the message instead.
export const staleServerFnMiddleware = createMiddleware().server(async ({ next, handlerType }) => {
  if (handlerType !== "serverFn") {
    return next();
  }
  try {
    return await next();
  } catch (error) {
    if (error instanceof Error && STALE_SERVER_FN_ERROR_PATTERN.test(error.message)) {
      return new Response(error.message, {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
    throw error;
  }
});
