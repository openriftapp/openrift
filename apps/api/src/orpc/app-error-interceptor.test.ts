import { ORPCError, ValidationError } from "@orpc/server";
import { describe, expect, it } from "vitest";

import { AppError } from "../errors.js";
import { appErrorInterceptor } from "./app-error-interceptor.js";

async function thrownBy(error: unknown): Promise<unknown> {
  try {
    await appErrorInterceptor({
      next: () => {
        throw error;
      },
    });
  } catch (error_) {
    return error_;
  }
  throw new Error("expected a throw");
}

describe("appErrorInterceptor", () => {
  it("converts an AppError into an ORPCError with the same status and code", async () => {
    const error = await thrownBy(new AppError(409, "CONFLICT", "Already there"));
    expect(error).toBeInstanceOf(ORPCError);
    expect(error).toMatchObject({ code: "CONFLICT", status: 409, message: "Already there" });
  });

  it("trims an input validation failure to path and message per issue", async () => {
    const cause = new ValidationError({
      message: "Input validation failed",
      // Zod issues carry more (`code`, `format`, `pattern`); only path and message may reach the wire.
      issues: [
        { path: ["printingId"], message: "Invalid UUID", pattern: "/^[0-9a-f-]+$/" } as never,
        { path: [], message: "printings must not be empty" },
      ],
    });
    const error = await thrownBy(
      new ORPCError("BAD_REQUEST", { message: "Input validation failed", cause }),
    );
    expect(error).toBeInstanceOf(ORPCError);
    const orpc = error as ORPCError<string, unknown>;
    expect(orpc.status).toBe(400);
    expect(orpc.message).toBe("Input validation failed");
    expect(orpc.data).toEqual({
      issues: [
        { path: "printingId", message: "Invalid UUID" },
        { path: "", message: "printings must not be empty" },
      ],
    });
    expect(orpc.cause).toBe(cause);
  });

  it("leaves an output validation failure alone", async () => {
    const cause = new ValidationError({ message: "Output validation failed", issues: [] });
    const original = new ORPCError("INTERNAL_SERVER_ERROR", { cause });
    expect(await thrownBy(original)).toBe(original);
  });

  it("passes every other error through unchanged", async () => {
    const original = new Error("boom");
    expect(await thrownBy(original)).toBe(original);
  });
});
