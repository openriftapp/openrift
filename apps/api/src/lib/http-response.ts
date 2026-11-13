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

export const IMAGE_CACHE = {
  versioned: "public, immutable, max-age=31536000",
  daily: "public, max-age=86400",
  private: "private, no-store",
} as const;

export function pngResponse(png: Buffer, cacheControl: string = IMAGE_CACHE.private): Response {
  return new Response(png, {
    status: 200,
    headers: { "Content-Type": "image/png", "Cache-Control": cacheControl },
  });
}
