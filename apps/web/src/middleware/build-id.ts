import { BUILD_ID_HEADER, isBuildIdSafe } from "@openrift/shared/contracts/api-format";
import { createMiddleware } from "@tanstack/react-start";

import { COMMIT_HASH } from "@/lib/env";

export function stampBuildId(response: Response): void {
  if (!isBuildIdSafe(response.headers.get("Cache-Control"))) {
    return;
  }
  try {
    response.headers.set(BUILD_ID_HEADER, COMMIT_HASH);
  } catch {
    // Node guards the headers of Response.redirect() and Response.error() as
    // immutable. The build id is optional, so a failed stamp must not fail the request.
  }
}

// Server-function responses are a tab's most frequent contact with this server,
// so stamping them is what lets an idle tab notice a deploy before it fails.
export const buildIdMiddleware = createMiddleware().server(async ({ next }) => {
  const result = await next();
  stampBuildId(result.response);
  return result;
});
