import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import {
  BOARD_STATE_CREATES_PER_HOUR,
  BOARD_STATE_SHARES_PER_HOUR,
  mountBoardStatesRateLimit,
} from "./authenticated-board-states-rate-limit";

// Mounted on a bare app with stub handlers: the limiter decides before any router runs.
const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  const userId = c.req.header("x-test-user");
  c.set("user", userId ? ({ id: userId } as never) : null);
  await next();
});
mountBoardStatesRateLimit(app);
app.get("/api/v1/board-states", (c) => c.json({ items: [] }));
app.post("/api/v1/board-states", (c) => c.json({}, 201));
app.patch("/api/v1/board-states/:id", (c) => c.json({}));
app.post("/api/v1/board-states/:id/share", (c) => c.json({ isPublic: true }));
app.delete("/api/v1/board-states/:id/share", (c) => c.body(null, 204));

function send(method: string, path: string, userId?: string) {
  const headers: Record<string, string> = {};
  if (userId) {
    headers["x-test-user"] = userId;
  }
  return app.request(`/api/v1${path}`, { method, headers });
}

async function burst(count: number, method: string, path: string, userId: string) {
  for (let i = 0; i < count; i++) {
    const res = await send(method, path, userId);
    expect(res.status).toBeLessThan(400);
  }
}

describe("board state rate limits", () => {
  it("rejects creates over the hourly cap with a 429 the oRPC client can parse", async () => {
    await burst(BOARD_STATE_CREATES_PER_HOUR, "POST", "/board-states", "creator");

    const res = await send("POST", "/board-states", "creator");

    expect(res.status).toBe(429);
    expect(await readJson(res)).toMatchObject({
      defined: false,
      code: "TOO_MANY_REQUESTS",
      status: 429,
    });
  });

  it("counts each user separately", async () => {
    await burst(BOARD_STATE_CREATES_PER_HOUR, "POST", "/board-states", "busy");

    const res = await send("POST", "/board-states", "other");
    expect(res.status).toBe(201);
  });

  it("does not count list, edit or unshare requests", async () => {
    await burst(BOARD_STATE_CREATES_PER_HOUR + 5, "GET", "/board-states", "reader");
    await burst(BOARD_STATE_SHARES_PER_HOUR + 5, "PATCH", "/board-states/b1", "reader");
    await burst(BOARD_STATE_SHARES_PER_HOUR + 5, "DELETE", "/board-states/b1/share", "reader");

    const created = await send("POST", "/board-states", "reader");
    expect(created.status).toBe(201);
    const shared = await send("POST", "/board-states/b1/share", "reader");
    expect(shared.status).toBe(200);
  });

  it("caps new share links per hour across board states", async () => {
    await burst(BOARD_STATE_SHARES_PER_HOUR, "POST", "/board-states/b1/share", "sharer");

    const res = await send("POST", "/board-states/b2/share", "sharer");
    expect(res.status).toBe(429);
  });

  it("lets signed-out requests through to the router", async () => {
    for (let i = 0; i <= BOARD_STATE_CREATES_PER_HOUR; i++) {
      const res = await send("POST", "/board-states");
      expect(res.status).toBe(201);
    }
  });
});
