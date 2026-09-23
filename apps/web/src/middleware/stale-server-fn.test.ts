import { describe, expect, it } from "vitest";

import { STALE_SERVER_FN_ERROR_PATTERN } from "@/lib/stale-bundle-reload";

import { staleServerFnMiddleware } from "./stale-server-fn";

// oxlint-disable-next-line @typescript-eslint/no-non-null-assertion -- the middleware always has a server handler
const handler = staleServerFnMiddleware.options.server!;

async function run(handlerType: string, next: () => Promise<unknown>): Promise<unknown> {
  return await handler({ handlerType, next } as never);
}

describe("staleServerFnMiddleware", () => {
  it("answers an unknown server function id with a plain-text 404", async () => {
    const result = await run("serverFn", () =>
      Promise.reject(new Error("Server function info not found for abc123")),
    );

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toContain("text/plain");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toMatch(STALE_SERVER_FN_ERROR_PATTERN);
  });

  it("rethrows other server function errors", async () => {
    const error = new Error("database unavailable");
    await expect(run("serverFn", () => Promise.reject(error))).rejects.toBe(error);
  });

  it("passes a successful server function result through", async () => {
    const result = { response: new Response("ok") };
    await expect(run("serverFn", () => Promise.resolve(result))).resolves.toBe(result);
  });

  it("leaves router requests alone", async () => {
    const error = new Error("Server function info not found for abc123");
    await expect(run("router", () => Promise.reject(error))).rejects.toBe(error);
  });
});
