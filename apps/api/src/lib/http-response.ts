import type { ErrorCode } from "@openrift/shared/error-codes";
import type { ApiErrorResponse } from "@openrift/shared/types/api/error";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { codeForStatus } from "../errors.js";

/** The `{ error, code }` envelope `app.onError` answers with, for Hono routes that return instead of throw. */
export function jsonError(
  c: Context,
  status: ContentfulStatusCode,
  message: string,
  code?: ErrorCode,
): Response {
  const body: ApiErrorResponse = { error: message, code: code ?? codeForStatus(status) };
  return c.json(body, status);
}

export function pngResponse(png: Buffer, cacheControl = "private, no-store"): Response {
  return new Response(png, {
    status: 200,
    headers: { "Content-Type": "image/png", "Cache-Control": cacheControl },
  });
}
