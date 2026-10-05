import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { jsonError, pngResponse } from "./http-response.js";

describe("jsonError", () => {
  it("answers with the error envelope and a code derived from the status", async () => {
    const app = new Hono().get("/", (c) => jsonError(c, 404, "Not found"));
    const res = await app.request("/");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found", code: "NOT_FOUND" });
  });

  it("uses an explicit code when given", async () => {
    const app = new Hono().get("/", (c) => jsonError(c, 501, "Nope", "BAD_REQUEST"));
    const res = await app.request("/");
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({ error: "Nope", code: "BAD_REQUEST" });
  });

  it("falls back to INTERNAL_ERROR for an unmapped 5xx", async () => {
    const app = new Hono().get("/", (c) => jsonError(c, 502, "Upstream"));
    const res = await app.request("/");
    expect(await res.json()).toEqual({ error: "Upstream", code: "INTERNAL_ERROR" });
  });
});

describe("pngResponse", () => {
  it("defaults to a private, uncached PNG", async () => {
    const res = pngResponse(Buffer.from([1, 2, 3]));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("uses the given Cache-Control", () => {
    const res = pngResponse(Buffer.from([]), "public, max-age=60");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
  });
});
