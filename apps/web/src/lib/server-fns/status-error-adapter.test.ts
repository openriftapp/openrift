import { ORPCError } from "@orpc/client";
import { defaultSerovalPlugins, makeSerovalPlugin } from "@tanstack/router-core";
import { fromCrossJSON, toCrossJSONAsync } from "seroval";
import { describe, expect, it } from "vitest";

import { ApiError, errorStatus, isApiError } from "./api-error";
import { statusErrorAdapter } from "./status-error-adapter";

const plugins = [makeSerovalPlugin(statusErrorAdapter), ...defaultSerovalPlugins];

async function crossServerFnBoundary(error: unknown): Promise<unknown> {
  const json = await toCrossJSONAsync(error, { refs: new Map(), plugins });
  return fromCrossJSON(json, { refs: new Map(), plugins });
}

describe("statusErrorAdapter", () => {
  it("keeps an oRPC error's status and message", async () => {
    const error = new ORPCError("CONFLICT", {
      status: 409,
      message: "That card is no longer available to trade",
    });

    const received = await crossServerFnBoundary(error);

    expect(received).toBeInstanceOf(Error);
    expect(errorStatus(received)).toBe(409);
    expect((received as Error).message).toBe("That card is no longer available to trade");
  });

  it("keeps an ApiError recognizable with its code and diagnostic", async () => {
    const error = new ApiError("Not allowed", {
      status: 403,
      code: "FORBIDDEN",
      details: { field: "name" },
      diagnostic: "POST /api/v1/x → 403 Forbidden",
    });

    const received = await crossServerFnBoundary(error);

    expect(isApiError(received)).toBe(true);
    expect(received).toMatchObject({
      status: 403,
      code: "FORBIDDEN",
      diagnostic: "POST /api/v1/x → 403 Forbidden",
    });
  });

  it("leaves an error without a status to the default plugin", async () => {
    const received = await crossServerFnBoundary(new TypeError("Failed to fetch"));

    expect(received).toBeInstanceOf(Error);
    expect(errorStatus(received)).toBeUndefined();
    expect((received as Error).message).toBe("Failed to fetch");
  });
});
